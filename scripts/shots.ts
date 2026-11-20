import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

interface PixelRatio {
  className: string;
  native: [number, number];
  displayed: [number, number];
  ratio: [number, number];
}

const PIXEL_RATIOS: Record<string, PixelRatio[]> = {};
const LAYOUT_OVERFLOW: Record<string, { className: string; left: number; right: number; viewport: number }[]> = {};

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
      if (message.method === "Runtime.exceptionThrown") {
        const error = JSON.stringify(message.params);
        if (!error.includes("kaspersky-labs.com")) this.errors.push(error);
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") this.errors.push(JSON.stringify(message.params));
      if (message.method === "Log.entryAdded" && (message.params?.entry as { level?: string })?.level === "error") {
        const entry = JSON.stringify(message.params);
        if (!entry.includes("kaspersky-labs.com") && !entry.includes("ERR_INTERNET_DISCONNECTED")) this.errors.push(entry);
      }
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
  const raw = await evaluate(cdp, `localStorage.getItem("earth:life:v10")`);
  if (!raw) throw new Error("Сохранение v10 не найдено");
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
      const skip = [...document.querySelectorAll("button")].find((node) => node.textContent === "Прожить год");
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
  const attempts: unknown[] = [];
  for (let attempt = 0; attempt < 16; attempt++) {
    await clickButton(cdp, "Политика");
    await waitForSelector(cdp, ".politics-view");
    await evaluate(cdp, `(() => { const select = document.querySelector(".politics-view select"); select.value = ${JSON.stringify(level)}; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    const availability = await evaluate(cdp, `(() => { const button = [...document.querySelectorAll(".politics-platforms button")].find((node) => node.textContent.includes("Сообщество ·")); return { disabled: button?.disabled, cost: document.querySelector(".politics-campaign-cost")?.textContent }; })()`);
    await clickButton(cdp, "Сообщество ·");
    let state = await savedState(cdp);
    attempts.push({ attempt, availability, cash: state.finance.cash, afterClick: state.politics.career, age: state.age });
    if (state.politics.career.status === "candidate") {
      const electionYear = state.politics.career.nextElectionYear;
      await backToMain(cdp);
      await advanceToAge(cdp, electionYear - state.birth.year + 1);
      state = await savedState(cdp);
      attempts[attempts.length - 1] = { ...(attempts[attempts.length - 1] as object), afterElection: state.politics.career, age: state.age };
      if (state.politics.career.status === "inOffice" && state.politics.career.level === level) return;
    } else {
      await backToMain(cdp);
      await advanceToAge(cdp, state.age + 1);
    }
  }
  const state = await savedState(cdp);
  throw new Error(`Не удалось победить на уровне ${level}: ${JSON.stringify({ age: state.age, cash: state.finance.cash, education: state.scales.education, career: state.politics.career, training: state.politics.trainingComplete, attempts })}`);
}

async function finishTerm(cdp: Cdp): Promise<void> {
  const state = await savedState(cdp);
  if (state.politics.career.status === "inOffice") await advanceToAge(cdp, state.politics.career.termEndYear - state.birth.year + 1);
}

async function playToEnd(cdp: Cdp): Promise<void> {
  for (let step = 0; step < 5000; step++) {
    const action = await evaluate(cdp, `(() => {
      if (document.querySelector(".memorial-view.ended")) return "end";
      const choice = document.querySelector(".choice button");
      if (choice) { choice.click(); return "choice"; }
      const skip = [...document.querySelectorAll("button")].find((node) => node.textContent === "Прожить год");
      if (skip) { skip.click(); return "skip"; }
      return "waiting";
    })()`);
    if (action === "end") return;
    if (action === "waiting") throw new Error("Нет действия до конца жизни");
    if (cdp.errors.length > 0) throw new Error(cdp.errors.join("\n"));
    await new Promise((resolveWait) => setTimeout(resolveWait, 8));
  }
  throw new Error("Жизнь не завершилась за 5000 действий");
}

async function capture(cdp: Cdp, out: string, name: string, width: number, height: number, mobile = false): Promise<void> {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  const overflow = await evaluate(cdp, `document.documentElement.scrollWidth > window.innerWidth`);
  if (overflow) throw new Error(`Горизонтальное переполнение: ${name}`);
  PIXEL_RATIOS[name] = await evaluate(cdp, `(() => [...document.querySelectorAll("canvas")].filter((canvas) => { const rect = canvas.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).map((canvas) => { const rect = canvas.getBoundingClientRect(); return { className: canvas.className, native: [canvas.width, canvas.height], displayed: [canvas.clientWidth, canvas.clientHeight], ratio: [canvas.clientWidth / canvas.width, canvas.clientHeight / canvas.height] }; }))()`) as PixelRatio[];
  LAYOUT_OVERFLOW[name] = await evaluate(cdp, `(() => [...document.querySelectorAll("canvas, .memory-photo, .finance-section, .person-card")].flatMap((node) => { const rect = node.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0 || (rect.left >= -1 && rect.right <= innerWidth + 1)) return []; return [{ className: node.getAttribute("class") ?? node.tagName, left: rect.left, right: rect.right, viewport: innerWidth }]; }))()`) as { className: string; left: number; right: number; viewport: number }[];
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, `${name}.png`), Buffer.from(String(shot.data), "base64"));
}

async function captureGame(cdp: Cdp, out: string, name: string, width: number, height: number, mobile = false): Promise<void> {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await new Promise((resolveWait) => setTimeout(resolveWait, 60));
  const overflow = await evaluate(cdp, `document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight`);
  if (overflow) {
    const metrics = await evaluate(cdp, `({ viewport: [innerWidth, innerHeight], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], main: document.querySelector(".game-shell").getBoundingClientRect().toJSON() })`);
    throw new Error(`Внешняя прокрутка основного экрана: ${name}: ${JSON.stringify(metrics)}`);
  }
  await capture(cdp, out, name, width, height, mobile);
}

async function captureExtra(cdp: Cdp, out: string, name: string, game = false, desktop = false): Promise<void> {
  const viewports: [string, number, number, boolean][] = [
    ["320", 320, 720, true],
    ["768", 768, 1024, true],
  ];
  if (desktop) viewports.push(["1280", 1280, 720, false], ["1440", 1440, 1080, false]);
  for (const [suffix, width, height, mobile] of viewports) {
    if (game) await captureGame(cdp, out, `${name}-${suffix}`, width, height, mobile);
    else await capture(cdp, out, `${name}-${suffix}`, width, height, mobile);
  }
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
    await page.call("Page.addScriptToEvaluateOnNewDocument", { source: `if (location.protocol.startsWith("http")) localStorage.setItem("earth:language", "ru");` });
    await page.call("Network.enable");
    await page.call("Network.emulateNetworkConditions", { offline: false, latency: 100, downloadThroughput: 500000, uploadThroughput: 250000 });
    const navigationStarted = Date.now();
    await page.call("Page.navigate", { url: base });
    await waitForSelector(page, "#soften-start");
    const welcomeMs = Date.now() - navigationStarted;
    await capture(page, out, "welcome-1920", 1920, 1080);
    await capture(page, out, "welcome-mobile", 390, 844, true);
    await captureExtra(page, out, "welcome", false, true);
    await evaluate(page, `document.querySelector("#soften-start").click()`);
    const startClickedAt = Date.now();
    await clickButton(page, "Начать новую жизнь");
    await waitForSelector(page, ".time-controls");
    const interactiveMs = welcomeMs + (Date.now() - startClickedAt);
    await page.call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (!(await savedState(page)).softenHeavy) throw new Error("Смягчение на старте не применилось");
    await clickButton(page, "Смягчить тяжёлые темы");
    if ((await savedState(page)).softenHeavy) throw new Error("Переключатель смягчения не выключился");
    await clickButton(page, "Прожить год");
    await waitForSelector(page, ".event");
    await captureGame(page, out, "main-1920", 1920, 1080);
    await captureGame(page, out, "main-1440", 1440, 1080);
    await captureGame(page, out, "main-1280", 1280, 720);
    await captureGame(page, out, "main-mobile", 390, 844, true);
    await captureExtra(page, out, "main", true);
    for (const tab of ["hero", "focus", "menu"] as const) {
      await evaluate(page, `document.querySelector('.mobile-tabs button[data-tab="${tab}"]').click()`);
      const active = await evaluate(page, `document.querySelector(".game-shell").dataset.active`);
      if (active !== tab) throw new Error(`Мобильная вкладка не открылась: ${tab}`);
      await captureGame(page, out, `main-mobile-${tab}`, 390, 844, true);
    }
    await evaluate(page, `document.querySelector('.mobile-tabs button[data-tab="event"]').click()`);
    await evaluate(page, `document.querySelector(".choice button").click()`);
    await waitForSelector(page, ".outcome-inline");
    const outcomeFlow = await evaluate(page, `(() => ({
      continueButton: Boolean(document.querySelector(".outcome + button")),
      nextAction: Boolean(document.querySelector(".choice button") || [...document.querySelectorAll("button")].find((node) => node.textContent === "Прожить год")),
    }))()`) as { continueButton: boolean; nextAction: boolean };
    if (outcomeFlow.continueButton || !outcomeFlow.nextAction) throw new Error(`Итог блокирует темп: ${JSON.stringify(outcomeFlow)}`);
    await captureGame(page, out, "outcome-inline-1920", 1920, 1080);
    await captureGame(page, out, "outcome-inline-mobile", 390, 844, true);
    await clickButton(page, "Люди ·");
    await waitForSelector(page, ".person-card");
    await capture(page, out, "people-1920", 1920, 1080);
    await capture(page, out, "people-mobile", 390, 844, true);
    await captureExtra(page, out, "people");
    await clickButton(page, "Назад");
    await waitForSelector(page, ".time-controls");
    await clickButton(page, "Деньги ·");
    await waitForSelector(page, ".finance-view");
    await capture(page, out, "finance-1920", 1920, 1080);
    await capture(page, out, "finance-mobile", 390, 844, true);
    await captureExtra(page, out, "finance");
    await clickButton(page, "Назад");
    await waitForSelector(page, ".time-controls");
    await clickButton(page, "Образ жизни");
    await waitForSelector(page, ".lifestyle-view");
    await capture(page, out, "lifestyle-1920", 1920, 1080);
    await capture(page, out, "lifestyle-mobile", 390, 844, true);
    await captureExtra(page, out, "lifestyle");
    await clickButton(page, "Назад");
    await waitForSelector(page, ".time-controls");
    await clickButton(page, "Моменты ·");
    await waitForSelector(page, ".memorial-view:not(.ended)");
    await capture(page, out, "journal-1920", 1920, 1080);
    await capture(page, out, "journal-mobile", 390, 844, true);
    await captureExtra(page, out, "journal");
    await clickButton(page, "Назад");
    await waitForSelector(page, ".time-controls");

    await clickButton(page, "Политика");
    await waitForSelector(page, ".politics-view");
    await capture(page, out, "politics-1920", 1920, 1080);
    await capture(page, out, "politics-mobile", 390, 844, true);
    await captureExtra(page, out, "politics", false, true);
    await backToMain(page);
    await advanceToAge(page, 5);
    await clickButton(page, "Образование Образование сильно");
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

    await playToEnd(page);
    const ended = true;
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
    await captureExtra(page, out, "memorial");
    await evaluate(page, `document.querySelector(".photo-album").scrollIntoView({ block: "start" })`);
    await capture(page, out, "memorial-album-1920", 1920, 1080);
    await capture(page, out, "memorial-album-mobile", 390, 844, true);
    await captureExtra(page, out, "memorial-album");
    await evaluate(page, `document.querySelector(".memorial-canvas").scrollIntoView({ block: "start" })`);
    await capture(page, out, "memorial-room-mobile", 390, 844, true);

    await page.call("Page.reload", { ignoreCache: true });
    await waitFor(async () => Boolean(await evaluate(page, `performance.getEntriesByType("navigation")[0]?.type === "reload" && document.querySelector(".memorial-view.ended")`)), "перезагрузка мемориала");
    const restoredFavorites = await evaluate(page, `document.querySelectorAll(".favorite-button.active").length`);
    if (restoredFavorites !== 32) throw new Error(`После перезагрузки избранных: ${restoredFavorites}`);
    const restoredPolitics = (await savedState(page)).politics;
    if (restoredPolitics.career.lastLevel !== "national" || !restoredPolitics.alternative.changes.some((change: { success: boolean }) => change.success)) throw new Error("Политическая история не сохранилась после перезагрузки");
    const savedBefore = await evaluate(page, `localStorage.getItem("earth:life:v10")`);
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await evaluate(page, `document.querySelector(".gifted-day").scrollIntoView({ block: "start" }); document.querySelector(".gifted-day summary").click()`);
    await waitForSelector(page, ".gifted-day[open]");
    await capture(page, out, "gifted-day-1920", 1920, 1080);
    const savedAfter = await evaluate(page, `localStorage.getItem("earth:life:v10")`);
    if (savedBefore !== savedAfter) throw new Error("Подаренный день изменил сохранение");

    const inheritanceBase = new URL(String(await evaluate(page, "location.href")));
    inheritanceBase.searchParams.set("seed", "turn-inheritance-0");
    await page.call("Page.navigate", { url: inheritanceBase.href });
    await waitForSelector(page, "#soften-start");
    await clickButton(page, "Начать новую жизнь");
    await waitForSelector(page, ".time-controls");
    await playToEnd(page);
    let inheritedGeneration = 1;
    for (const targetGeneration of [2, 3]) {
      await waitForSelector(page, ".memorial-view.ended");
      if (targetGeneration === 2) await capture(page, out, "inheritance-mobile", 390, 844, true);
      const clicked = await evaluate(page, `(() => { const heir = document.querySelector(".inheritance-heir"); if (!heir) return false; heir.click(); return true; })()`);
      if (!clicked) throw new Error(`Нет наследника для поколения ${targetGeneration}`);
      await waitForSelector(page, ".time-controls");
      let inheritedState = await savedState(page);
      if (inheritedState.lineage.generation !== targetGeneration) throw new Error(`Неверное поколение: ${inheritedState.lineage.generation}`);
      inheritedGeneration = targetGeneration;
      await clickButton(page, "Род ·");
      await waitForSelector(page, ".lineage-view");
      await capture(page, out, `lineage-${targetGeneration}-1920`, 1920, 1080);
      await capture(page, out, `lineage-${targetGeneration}-mobile`, 390, 844, true);
      if (targetGeneration === 2) await captureExtra(page, out, "lineage-2");
      await page.call("Page.reload", { ignoreCache: true });
      await waitFor(async () => Boolean(await evaluate(page, `performance.getEntriesByType("navigation")[0]?.type === "reload" && document.querySelector(".time-controls")`)), `перезагрузка поколения ${targetGeneration}`);
      inheritedState = await savedState(page);
      if (inheritedState.lineage.generation !== targetGeneration) throw new Error("Поколение не сохранилось после перезагрузки");
      await playToEnd(page);
    }
    await clickButton(page, "Род ·");
    await waitForSelector(page, ".lineage-view");
    await capture(page, out, "lineage-final-1920", 1920, 1080);

    await waitFor(async () => Boolean(await evaluate(page, `(async () => {
      const assets = await (await fetch("sw-assets.json")).json();
      const key = (await caches.keys()).find((name) => name.startsWith("earth-v1.0.0-"));
      if (!key) return false;
      const cache = await caches.open(key);
      return (await cache.keys()).length >= assets.length && navigator.serviceWorker.controller !== null;
    })()`)), "готовность оффлайн-кэша");
    await page.call("Network.enable");
    await page.call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await page.call("Page.reload", { ignoreCache: true });
    await waitForSelector(page, ".memorial-view.ended");
    const offlineGeneration = (await savedState(page)).lineage.generation;
    if (offlineGeneration !== 3) throw new Error(`Оффлайн-поколение: ${offlineGeneration}`);
    await page.call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });

    const names = ["welcome-1920", "welcome-mobile", "main-1920", "main-1440", "main-1280", "main-mobile", "main-mobile-hero", "main-mobile-focus", "main-mobile-menu", "outcome-inline-1920", "outcome-inline-mobile", "people-1920", "people-mobile", "finance-1920", "finance-mobile", "lifestyle-1920", "lifestyle-mobile", "journal-1920", "journal-mobile", "politics-1920", "politics-mobile", "politics-office-1920", "politics-office-mobile", "politics-referendum-1920", "politics-referendum-mobile", "politics-alternative-1920", "memorial-1920", "memorial-mobile", "memorial-album-1920", "memorial-album-mobile", "memorial-room-mobile", "gifted-day-1920", "inheritance-mobile", "lineage-2-1920", "lineage-2-mobile", "lineage-3-1920", "lineage-3-mobile", "lineage-final-1920"];
    names.push(...["welcome", "politics"].flatMap((name) => ["320", "768", "1280", "1440"].map((suffix) => `${name}-${suffix}`)));
    names.push(...["main", "people", "finance", "lifestyle", "journal", "memorial", "memorial-album", "lineage-2"].flatMap((name) => ["320", "768"].map((suffix) => `${name}-${suffix}`)));
    const cards = names.map((name) => `<figure><figcaption>${name}</figcaption><img src="${name}.png" /></figure>`);
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f3ecdf;color:#343a45;font:18px system-ui}h1{font-size:26px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;padding:12px;background:#fffaf2;border:2px solid #b78b52;border-radius:12px}figcaption{padding-bottom:10px}img{display:block;width:100%;height:420px;object-fit:contain;background:#f8f3e9;border-radius:8px}</style><h1>Earth — визуальная проверка</h1><main>${cards.join("")}</main>`;
    await writeFile(join(out, "contact.html"), html);
    await page.call("Page.navigate", { url: `file:///${join(out, "contact.html").replaceAll("\\", "/")}` });
    await waitFor(async () => Boolean(await evaluate(page, `document.readyState === "complete" && [...document.images].every((img) => img.complete)`)), "сводный лист");
    const metrics = await page.call("Page.getLayoutMetrics");
    const contentHeight = Math.ceil((metrics.cssContentSize as { height: number }).height);
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1600, height: Math.min(contentHeight, 6000), deviceScaleFactor: 1, mobile: false });
    const contact = await page.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(join(out, "contact.png"), Buffer.from(String(contact.data), "base64"));
    const badPixelRatios = Object.entries(PIXEL_RATIOS).flatMap(([screen, items]) => items.flatMap((item) => item.ratio.some((ratio) => ratio !== 1 && ratio !== 2) ? [{ screen, ...item }] : []));
    const badLayoutOverflow = Object.entries(LAYOUT_OVERFLOW).flatMap(([screen, items]) => items.map((item) => ({ screen, ...item })));
    await writeFile(join(out, "report.json"), JSON.stringify({ screens: names, welcomeMs, interactiveMs, lifeEnded: ended, restoredFavorites, giftedDayPreservedSave: savedBefore === savedAfter, politicalLevel: politicalState.politics.career.level, referendumAccepted, alternativeMortalityFactor: politicalState.politics.alternative.mortalityFactor, restoredPoliticalLevel: restoredPolitics.career.lastLevel, restoredAlternativeChanges: restoredPolitics.alternative.changes.length, inheritedGeneration, offlineGeneration, pixelRatios: PIXEL_RATIOS, badPixelRatios, layoutOverflow: LAYOUT_OVERFLOW, badLayoutOverflow, consoleErrors: page.errors }, null, 2));
    if (badPixelRatios.length > 0) throw new Error(`Нецелый масштаб canvas: ${JSON.stringify(badPixelRatios)}`);
    if (badLayoutOverflow.length > 0) throw new Error(`Элементы выходят за viewport: ${JSON.stringify(badLayoutOverflow)}`);
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
