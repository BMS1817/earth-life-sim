import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
}

class Cdp {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  readonly errors: string[] = [];

  private socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      if (message.method === "Runtime.exceptionThrown") this.errors.push(JSON.stringify(message.params));
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") this.errors.push(JSON.stringify(message.params));
      if (message.method === "Log.entryAdded" && (message.params?.entry as { level?: string })?.level === "error") this.errors.push(JSON.stringify(message.params));
    });
  }

  static async open(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("CDP WebSocket error")), { once: true });
    });
    const cdp = new Cdp(socket);
    await Promise.all([cdp.call("Page.enable"), cdp.call("Runtime.enable"), cdp.call("Log.enable")]);
    return cdp;
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    this.socket.close();
  }
}

function chromePath(): string {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("Chrome не найден; задайте CHROME_BIN");
  return executable;
}

async function waitFor(check: () => Promise<boolean>, description: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  }
  throw new Error(`Таймаут: ${description}`);
}

async function evaluate(cdp: Cdp, expression: string): Promise<unknown> {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true });
  return (result.result as { value?: unknown })?.value;
}

async function waitForSelector(cdp: Cdp, selector: string): Promise<void> {
  await waitFor(async () => Boolean(await evaluate(cdp, `document.readyState === "complete" && document.querySelector(${JSON.stringify(selector)})`)), selector);
}

async function clickButton(cdp: Cdp, text: string): Promise<void> {
  const clicked = await evaluate(cdp, `(() => { const b = [...document.querySelectorAll("button")].find((node) => node.textContent.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
  if (!clicked) throw new Error(`Кнопка не найдена: ${text}`);
}

async function savedState(cdp: Cdp): Promise<any> {
  const raw = await evaluate(cdp, `localStorage.getItem("earth:life:v8")`);
  if (!raw) throw new Error("Сохранение v8 не найдено");
  return JSON.parse(String(raw));
}

async function backToMain(cdp: Cdp): Promise<void> {
  await evaluate(cdp, `(() => { const b = [...document.querySelectorAll("button")].find((node) => node.textContent === "Назад"); if (b) b.click(); })()`);
  await waitForSelector(cdp, ".time-controls");
}

async function advanceToAge(cdp: Cdp, targetAge: number): Promise<void> {
  for (let step = 0; step < 5000; step++) {
    const state = await savedState(cdp);
    if (!state.alive) throw new Error(`Герой умер раньше возраста ${targetAge}`);
    if (state.age >= targetAge) return;
    const action = await evaluate(cdp, `(() => {
      const choice = document.querySelector(".choice button");
      if (choice) { choice.click(); return "choice"; }
      const outcome = document.querySelector(".outcome + button");
      if (outcome) { outcome.click(); return "outcome"; }
      const skip = [...document.querySelectorAll("button")].find((node) => node.textContent === "До следующего решения");
      if (skip) { skip.click(); return "skip"; }
      return "waiting";
    })()`);
    if (action === "waiting") throw new Error(`Нет действия для продвижения к возрасту ${targetAge}`);
    if (cdp.errors.length > 0) throw new Error(cdp.errors.join("\n"));
    await new Promise((resolveWait) => setTimeout(resolveWait, 8));
  }
  throw new Error(`Слишком много действий до возраста ${targetAge}`);
}

async function runCampaign(cdp: Cdp, level: "local" | "regional" | "national"): Promise<void> {
  for (let attempt = 0; attempt < 16; attempt++) {
    await clickButton(cdp, "Политика");
    await waitForSelector(cdp, ".politics-view");
    await evaluate(cdp, `(() => { const select = document.querySelector(".politics-view select"); select.value = ${JSON.stringify(level)}; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await clickButton(cdp, "Сообщество ·");
    let state = await savedState(cdp);
    if (state.politics.career.status === "candidate") {
      const electionYear = state.politics.career.nextElectionYear;
      await backToMain(cdp);
      await advanceToAge(cdp, electionYear - state.birth.year + 1);
      state = await savedState(cdp);
      if (state.politics.career.status === "inOffice" && state.politics.career.level === level) return;
    } else {
      await backToMain(cdp);
      await advanceToAge(cdp, state.age + 1);
    }
  }
  const state = await savedState(cdp);
  throw new Error(`Не удалось победить на уровне ${level}: ${JSON.stringify({ age: state.age, cash: state.finance.cash, education: state.scales.education, career: state.politics.career, training: state.politics.trainingComplete })}`);
}

async function finishTerm(cdp: Cdp): Promise<void> {
  const state = await savedState(cdp);
  if (state.politics.career.status === "inOffice") await advanceToAge(cdp, state.politics.career.termEndYear - state.birth.year + 1);
}

async function capture(cdp: Cdp, out: string, name: string, width: number, height: number, mobile = false): Promise<void> {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  const overflow = await evaluate(cdp, `document.documentElement.scrollWidth > window.innerWidth`);
  if (overflow) throw new Error(`Горизонтальное переполнение: ${name}`);
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, `${name}.png`), Buffer.from(String(shot.data), "base64"));
}

async function main(): Promise<void> {
  const baseIndex = process.argv.indexOf("--base");
  const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "http://127.0.0.1:4173/?seed=art-review";
  const outIndex = process.argv.indexOf("--out");
  const out = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : "shots/art1");
  await mkdir(out, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), "earth-shots-"));
  const port = 9300 + Math.floor(Math.random() * 400);
  let chrome: ChildProcess | undefined;
  let cdp: Cdp | undefined;
  try {
    chrome = spawn(chromePath(), [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      `--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
    ], { stdio: "ignore" });
    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
      } catch {
        return false;
      }
    }, "запуск Chrome");
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json() as { webSocketDebuggerUrl: string };
    const page = await Cdp.open(target.webSocketDebuggerUrl);
    cdp = page;
    await page.call("Page.navigate", { url: base });
    await waitForSelector(page, ".time-controls");
    await clickButton(page, "До следующего решения");
    await waitForSelector(page, ".event");
    await clickButton(page, "Пауза");
    await capture(page, out, "main-1920", 1920, 1080);
    await capture(page, out, "main-1440", 1440, 1080);
    await capture(page, out, "main-1280", 1280, 720);
    await capture(page, out, "main-mobile", 390, 844, true);
    await clickButton(page, "Люди ·");
    await waitForSelector(page, ".person-card");
    await capture(page, out, "people-1920", 1920, 1080);
    await capture(page, out, "people-mobile", 390, 844, true);
    await clickButton(page, "Назад");
    await waitForSelector(page, ".event");
    await clickButton(page, "Деньги ·");
    await waitForSelector(page, ".finance-view");
    await capture(page, out, "finance-1920", 1920, 1080);
    await capture(page, out, "finance-mobile", 390, 844, true);
    await clickButton(page, "Назад");
    await waitForSelector(page, ".event");
    await clickButton(page, "Образ жизни");
    await waitForSelector(page, ".lifestyle-view");
    await capture(page, out, "lifestyle-1920", 1920, 1080);
    await capture(page, out, "lifestyle-mobile", 390, 844, true);
    await clickButton(page, "Назад");
    await waitForSelector(page, ".event");
    await clickButton(page, "Моменты ·");
    await waitForSelector(page, ".memorial-view:not(.ended)");
    await capture(page, out, "journal-1920", 1920, 1080);
    await capture(page, out, "journal-mobile", 390, 844, true);
    await clickButton(page, "Назад");
    await waitForSelector(page, ".event");

    await clickButton(page, "Политика");
    await waitForSelector(page, ".politics-view");
    await capture(page, out, "politics-1920", 1920, 1080);
    await capture(page, out, "politics-mobile", 390, 844, true);
    await backToMain(page);
    await advanceToAge(page, 5);
    await clickButton(page, "Учёба Образование");
    await advanceToAge(page, 18);
    await clickButton(page, "Политика");
    await waitForSelector(page, ".politics-view");
    await clickButton(page, "Подготовка к местной политике");
    await backToMain(page);
    await advanceToAge(page, 19);
    await runCampaign(page, "local");
    await finishTerm(page);
    await runCampaign(page, "regional");
    await finishTerm(page);
    await runCampaign(page, "national");
    await clickButton(page, "Политика");
    await waitForSelector(page, ".politics-view");
    await evaluate(page, `document.querySelectorAll(".politics-section")[1].scrollIntoView({ block: "start" })`);
    await capture(page, out, "politics-office-1920", 1920, 1080);
    await capture(page, out, "politics-office-mobile", 390, 844, true);
    await evaluate(page, `(() => {
      const fields = document.querySelectorAll(".politics-view select");
      fields[1].value = "termYears";
      fields[1].dispatchEvent(new Event("change", { bubbles: true }));
      fields[2].value = "6";
      fields[2].dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await clickButton(page, "Провести референдум");
    let politicalState = await savedState(page);
    const referendumAccepted = politicalState.politics.alternative.changes.at(-1)?.success === true;
    if (!referendumAccepted) throw new Error(`Референдум не принят в production-маршруте: ${JSON.stringify({ age: politicalState.age, career: politicalState.politics.career, constitution: politicalState.politics.constitution, changes: politicalState.politics.alternative.changes })}`);
    await evaluate(page, `document.querySelector(".politics-section:last-of-type").scrollIntoView({ block: "start" })`);
    await capture(page, out, "politics-referendum-1920", 1920, 1080);
    await capture(page, out, "politics-referendum-mobile", 390, 844, true);
    await backToMain(page);
    await advanceToAge(page, politicalState.age + 4);
    politicalState = await savedState(page);
    if (politicalState.politics.alternative.mortalityFactor === 1) throw new Error("Эффект поправки не наступил после лага");
    await clickButton(page, "Политика");
    await waitForSelector(page, ".politics-view");
    await evaluate(page, `document.querySelector(".politics-section:last-of-type").scrollIntoView({ block: "start" })`);
    await capture(page, out, "politics-alternative-1920", 1920, 1080);
    await backToMain(page);

    let ended = false;
    for (let step = 0; step < 1000; step++) {
      const action = await evaluate(page, `(() => {
        if (document.querySelector(".memorial-view.ended")) return "end";
        const choice = document.querySelector(".choice button");
        if (choice) { choice.click(); return "choice"; }
        const outcome = document.querySelector(".outcome + button");
        if (outcome) { outcome.click(); return "outcome"; }
        const skip = [...document.querySelectorAll("button")].find((node) => node.textContent === "До следующего решения");
        if (skip) { skip.click(); return "skip"; }
        return "waiting";
      })()`);
      if (action === "end") { ended = true; break; }
      await new Promise((resolveWait) => setTimeout(resolveWait, 8));
    }
    if (!ended) throw new Error("Жизнь не завершилась за 1000 действий");
    await waitForSelector(page, ".memorial-view.ended");
    for (let index = 0; index < 32; index++) {
      const selected = await evaluate(page, `(() => {
        const candidate = [...document.querySelectorAll(".favorite-button")].find((node) => !node.classList.contains("active") && !node.disabled);
        if (!candidate) return false;
        candidate.click();
        return true;
      })()`);
      if (!selected) throw new Error(`Не удалось отметить момент ${index + 1}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 8));
    }
    const favoriteCount = await evaluate(page, `document.querySelectorAll(".favorite-button.active").length`);
    if (favoriteCount !== 32) throw new Error(`Избранных моментов: ${favoriteCount}`);
    await evaluate(page, `window.scrollTo(0, 0)`);
    await capture(page, out, "memorial-1920", 1920, 1080);
    await capture(page, out, "memorial-mobile", 390, 844, true);
    await evaluate(page, `document.querySelector(".memorial-canvas").scrollIntoView({ block: "start" })`);
    await capture(page, out, "memorial-room-mobile", 390, 844, true);

    await page.call("Page.reload", { ignoreCache: true });
    await waitFor(async () => Boolean(await evaluate(page, `performance.getEntriesByType("navigation")[0]?.type === "reload" && document.querySelector(".memorial-view.ended")`)), "перезагрузка мемориала");
    const restoredFavorites = await evaluate(page, `document.querySelectorAll(".favorite-button.active").length`);
    if (restoredFavorites !== 32) throw new Error(`После перезагрузки избранных: ${restoredFavorites}`);
    const restoredPolitics = (await savedState(page)).politics;
    if (restoredPolitics.career.lastLevel !== "national" || !restoredPolitics.alternative.changes.some((change: { success: boolean }) => change.success)) throw new Error("Политическая история не сохранилась после перезагрузки");
    const savedBefore = await evaluate(page, `localStorage.getItem("earth:life:v8")`);
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await evaluate(page, `document.querySelector(".gifted-day").scrollIntoView({ block: "start" }); document.querySelector(".gifted-day summary").click()`);
    await waitForSelector(page, ".gifted-day[open]");
    await capture(page, out, "gifted-day-1920", 1920, 1080);
    const savedAfter = await evaluate(page, `localStorage.getItem("earth:life:v8")`);
    if (savedBefore !== savedAfter) throw new Error("Подаренный день изменил сохранение");

    const names = ["main-1920", "main-1440", "main-1280", "main-mobile", "people-1920", "people-mobile", "finance-1920", "finance-mobile", "lifestyle-1920", "lifestyle-mobile", "journal-1920", "journal-mobile", "politics-1920", "politics-mobile", "politics-office-1920", "politics-office-mobile", "politics-referendum-1920", "politics-referendum-mobile", "politics-alternative-1920", "memorial-1920", "memorial-mobile", "memorial-room-mobile", "gifted-day-1920"];
    const cards = names.map((name) => `<figure><figcaption>${name}</figcaption><img src="${name}.png" /></figure>`);
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#100d1b;color:#f0dfa8;font:18px system-ui}h1{font-size:26px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;padding:12px;background:#211937;border:2px solid #c79a52}figcaption{padding-bottom:10px}img{display:block;width:100%;height:420px;object-fit:contain;background:#171226}</style><h1>Earth — визуальная проверка</h1><main>${cards.join("")}</main>`;
    await writeFile(join(out, "contact.html"), html);
    await page.call("Page.navigate", { url: `file:///${join(out, "contact.html").replaceAll("\\", "/")}` });
    await waitFor(async () => Boolean(await evaluate(page, `document.readyState === "complete" && [...document.images].every((img) => img.complete)`)), "сводный лист");
    const metrics = await page.call("Page.getLayoutMetrics");
    const contentHeight = Math.ceil((metrics.cssContentSize as { height: number }).height);
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1600, height: Math.min(contentHeight, 6000), deviceScaleFactor: 1, mobile: false });
    const contact = await page.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(join(out, "contact.png"), Buffer.from(String(contact.data), "base64"));
    await writeFile(join(out, "report.json"), JSON.stringify({ screens: names, lifeEnded: ended, restoredFavorites, giftedDayPreservedSave: savedBefore === savedAfter, politicalLevel: politicalState.politics.career.level, referendumAccepted, alternativeMortalityFactor: politicalState.politics.alternative.mortalityFactor, restoredPoliticalLevel: restoredPolitics.career.lastLevel, restoredAlternativeChanges: restoredPolitics.alternative.changes.length, consoleErrors: page.errors }, null, 2));
    console.log(`Снимки: ${out}`);
    console.log(`Ошибки страницы: ${page.errors.length}`);
    if (page.errors.length > 0) throw new Error(page.errors.join("\n"));
  } finally {
    cdp?.close();
    const process = chrome;
    if (process && process.exitCode === null) {
      await new Promise<void>((resolveExit) => {
        process.once("exit", () => resolveExit());
        process.kill();
      });
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

await main();
