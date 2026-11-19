import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const base = value("--base", "http://127.0.0.1:4175/");
const out = resolve(value("--out", "shots/i18n-production"));

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
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
      if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
        const entry = JSON.stringify(message.params);
        if (!entry.includes("ERR_INTERNET_DISCONNECTED")) this.errors.push(entry);
      }
    });
  }
  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    const cdp = new Cdp(socket);
    await Promise.all([cdp.call("Page.enable"), cdp.call("Runtime.enable"), cdp.call("Log.enable")]);
    return cdp;
  }
  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket.close();
  }
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(40);
  }
  throw new Error(`Таймаут: ${description}`);
}
async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function waitSelector(cdp, selector) {
  await waitFor(async () => Boolean(await evaluate(cdp, `document.readyState === "complete" && document.querySelector(${JSON.stringify(selector)})`)), selector);
}
async function clickButton(cdp, text, exact = false) {
  const clicked = await evaluate(cdp, `(() => { const button = [...document.querySelectorAll("button")].find((node) => ${exact ? "node.textContent ===" : "node.textContent.includes"}(${JSON.stringify(text)})); if (!button) return false; button.click(); return true; })()`);
  if (!clicked) throw new Error(`Кнопка не найдена: ${text}`);
}
async function savedState(cdp) {
  const raw = await evaluate(cdp, `localStorage.getItem("earth:life:v10")`);
  if (!raw) throw new Error("Сохранение не найдено");
  return JSON.parse(String(raw));
}
async function capture(cdp, name, width = 1280, height = 720, mobile = false, game = false) {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await sleep(150);
  const overflow = await evaluate(cdp, `({ horizontal: document.documentElement.scrollWidth > innerWidth, vertical: document.documentElement.scrollHeight > innerHeight })`);
  if (overflow.horizontal || (game && overflow.vertical)) throw new Error(`Переполнение ${name}: ${JSON.stringify(overflow)}`);
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, `${name}.png`), Buffer.from(String(shot.data), "base64"));
  screens.push(name);
}
async function playToEnd(cdp) {
  for (let step = 0; step < 5000; step++) {
    const action = await evaluate(cdp, `(() => {
      if (document.querySelector(".memorial-view.ended")) return "end";
      const choice = document.querySelector(".choice button");
      if (choice) { choice.click(); return "choice"; }
      const skip = [...document.querySelectorAll("button")].find((node) => node.textContent === "Skip to next decision");
      if (skip) { skip.click(); return "skip"; }
      return "waiting";
    })()`);
    if (action === "end") return;
    if (action === "waiting") throw new Error(`Нет действия до конца жизни: ${await evaluate(cdp, `document.querySelector("#app").textContent`)}`);
    if (cdp.errors.length > 0) throw new Error(cdp.errors.join("\n"));
    await sleep(8);
  }
  throw new Error("Жизнь не завершилась за 5000 действий");
}
async function navigate(cdp, seed, params = {}, selector = "#soften-start") {
  const url = new URL(base);
  url.searchParams.set("seed", seed);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  await cdp.call("Page.navigate", { url: url.href });
  await waitSelector(cdp, selector);
}

const executable = [
  process.env.CHROME_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
if (!executable) throw new Error("Chrome не найден");
const profile = await mkdtemp(join(tmpdir(), "earth-i18n-"));
const port = 10_000 + Math.floor(Math.random() * 20_000);
const chrome = spawn(executable, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let cdp;
const screens = [];
const report = { base, passed: false, checks: {}, screens };
await mkdir(out, { recursive: true });
try {
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "запуск Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Network.enable");
  await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `if (location.protocol.startsWith("http") && !localStorage.getItem("earth:language")) localStorage.setItem("earth:language", "en");` });
  await navigate(cdp, "i18n-ui");
  if (await evaluate(cdp, `document.querySelector("h1").textContent`) !== "Before you begin") throw new Error("Английский старт не открылся");
  await capture(cdp, "en-welcome-1280");
  await capture(cdp, "en-welcome-mobile", 390, 844, true);
  await clickButton(cdp, "Русский", true);
  await waitFor(async () => await evaluate(cdp, `document.querySelector("h1")?.textContent`) === "Прежде чем начать", "переключение на русский");
  report.checks.languageSwitchToRu = true;
  await clickButton(cdp, "English", true);
  await waitFor(async () => await evaluate(cdp, `document.querySelector("h1")?.textContent`) === "Before you begin", "переключение на English");
  report.checks.languageSwitchToEn = true;
  await clickButton(cdp, "Start a new life", true);
  await waitSelector(cdp, ".time-controls");
  await clickButton(cdp, "Skip to next decision", true);
  await waitSelector(cdp, ".event");
  await clickButton(cdp, "Pause", true);
  const choiceCount = await evaluate(cdp, `document.querySelectorAll(".event .choice button").length`);
  if (choiceCount !== 4) throw new Error(`Решений в английском событии: ${choiceCount}`);
  report.checks.englishChoices = choiceCount;
  await capture(cdp, "en-event-1280", 1280, 720, false, true);
  await capture(cdp, "en-event-mobile", 390, 844, true, true);
  await evaluate(cdp, `document.querySelector(".event .choice button").click()`);
  await waitSelector(cdp, ".outcome-inline");
  report.checks.englishOutcome = await evaluate(cdp, `document.querySelector(".outcome-inline").textContent`);
  await capture(cdp, "en-outcome-1280", 1280, 720, false, true);
  await clickButton(cdp, "People ·");
  await waitSelector(cdp, ".people-view");
  if (await evaluate(cdp, `document.querySelector(".people-view h1").textContent`) !== "People in this life") throw new Error("Экран людей не переведён");
  await capture(cdp, "en-people-1280");
  await clickButton(cdp, "Back", true);
  await waitSelector(cdp, ".time-controls");
  await clickButton(cdp, "Moments ·");
  await waitSelector(cdp, ".memorial-view:not(.ended)");
  if (await evaluate(cdp, `document.querySelector(".memorial-view h1").textContent`) !== "Life journal") throw new Error("Дневник не переведён");
  await clickButton(cdp, "Back", true);
  await waitSelector(cdp, ".time-controls");

  await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("auditFamily")) return;
    const key = "earth:life:v10";
    const state = JSON.parse(localStorage.getItem(key));
    const parent = state.people.find((person) => person.role === "mother");
    state.seed = params.get("seed");
    state.age = 30;
    state.pendingEventIds = [];
    state.war.pendingEventId = null;
    state.pendingFamilyEventId = "family-parent-memory";
    state.lastOutcome = null;
    state.lastOutcomeKind = null;
    state.lastFamilyPersonId = parent.id;
    parent.name = "Anna";
    parent.alive = true;
    parent.present = true;
    parent.status = "active";
    parent.memories = [{ age: 10, year: state.birth.year + 10, eventId: "school-friend-fight", text: "Ты подошёл сам. Пришлось наступить на гордость.", impact: 3, kind: "support" }];
    localStorage.setItem(key, JSON.stringify(state));
  })()` });
  await navigate(cdp, "i18n-family", { auditFamily: 1 }, ".time-controls");
  await waitSelector(cdp, ".family-event");
  const familyText = await evaluate(cdp, `document.querySelector(".family-event > p").textContent`);
  if (!familyText.includes("recall the past: “") || !familyText.endsWith("”. It looks different now.") || familyText.includes("no shared memories yet") || /[А-Яа-яЁё]/u.test(familyText)) throw new Error(`Живая память не переведена: ${familyText}`);
  report.checks.familyMemory = familyText;
  await capture(cdp, "en-family-memory-1280", 1280, 720, false, true);

  await navigate(cdp, "inheritance-production-13");
  await clickButton(cdp, "Start a new life", true);
  await waitSelector(cdp, ".time-controls");
  await playToEnd(cdp);
  await waitSelector(cdp, ".memorial-view.ended");
  for (let index = 0; index < 32; index++) {
    const selected = await evaluate(cdp, `(() => {
      const candidate = [...document.querySelectorAll(".favorite-button")].find((node) => !node.classList.contains("active") && !node.disabled);
      if (!candidate) return false;
      candidate.click();
      return true;
    })()`);
    if (!selected) throw new Error(`Не удалось отметить момент ${index + 1}`);
    await sleep(8);
  }
  const favoriteCount = await evaluate(cdp, `document.querySelectorAll(".favorite-button.active").length`);
  if (favoriteCount !== 32) throw new Error(`Избранных моментов: ${favoriteCount}`);
  report.checks.favoriteMoments = favoriteCount;
  await evaluate(cdp, `window.scrollTo(0, 0)`);
  await capture(cdp, "en-memorial-1280");
  await capture(cdp, "en-memorial-mobile", 390, 844, true);
  await evaluate(cdp, `document.querySelector(".photo-album").scrollIntoView({ block: "start" })`);
  await capture(cdp, "en-album-mobile", 390, 844, true);

  for (const generation of [2, 3]) {
    const clicked = await evaluate(cdp, `(() => { const heir = document.querySelector(".inheritance-heir"); if (!heir) return false; heir.click(); return true; })()`);
    if (!clicked) throw new Error(`Нет наследника для поколения ${generation}`);
    await waitSelector(cdp, ".time-controls");
    if ((await savedState(cdp)).lineage.generation !== generation) throw new Error(`Неверное поколение ${generation}`);
    await clickButton(cdp, "Lineage ·");
    await waitSelector(cdp, ".lineage-view");
    if (await evaluate(cdp, `document.querySelector(".lineage-view h1").textContent`) !== "Lineage and generations") throw new Error("Род не переведён");
    await capture(cdp, `en-lineage-${generation}-1280`);
    await clickButton(cdp, "Back", true);
    await waitSelector(cdp, ".time-controls");
    await playToEnd(cdp);
  }
  report.checks.generation = (await savedState(cdp)).lineage.generation;

  await waitFor(async () => Boolean(await evaluate(cdp, `(async () => {
    const assets = await (await fetch("sw-assets.json")).json();
    const key = (await caches.keys()).find((name) => name.startsWith("earth-v1.0.0-"));
    if (!key) return false;
    const cache = await caches.open(key);
    return (await cache.keys()).length >= assets.length && navigator.serviceWorker.controller !== null;
  })()`, true)), "полный оффлайн-кэш", 240_000);
  await cdp.call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp.call("Page.reload", { ignoreCache: true });
  await sleep(500);
  await waitFor(async () => Boolean(await evaluate(cdp, `location.origin === ${JSON.stringify(new URL(base).origin)} && document.readyState === "complete" && navigator.serviceWorker.controller && document.querySelector(".memorial-view.ended")`)), "оффлайн-перезагрузка мемориала");
  report.checks.offlineGeneration = (await savedState(cdp)).lineage.generation;
  if (report.checks.offlineGeneration !== 3) throw new Error("Оффлайн-поколение не восстановлено");
  await cdp.call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  await evaluate(cdp, `localStorage.setItem("earth:language", "ru")`);
  await cdp.call("Page.reload", { ignoreCache: true });
  await sleep(500);
  await waitFor(async () => Boolean(await evaluate(cdp, `document.readyState === "complete" && document.querySelector(".memorial-view.ended")`)), "русский мемориал после перезагрузки");
  if (await evaluate(cdp, `document.querySelector(".memorial-view h1").textContent`) !== "Конец жизни") throw new Error("Русский мемориал не восстановлен");
  await clickButton(cdp, "Ещё одна жизнь", true);
  await waitSelector(cdp, "#soften-start");
  await clickButton(cdp, "Начать новую жизнь", true);
  await waitSelector(cdp, ".time-controls");
  await clickButton(cdp, "До следующего решения", true);
  await waitSelector(cdp, ".event");
  await clickButton(cdp, "Пауза", true);
  const russianChoices = await evaluate(cdp, `document.querySelectorAll(".event .choice button").length`);
  if (russianChoices !== 4) throw new Error(`Решений в русском событии: ${russianChoices}`);
  report.checks.russianChoices = russianChoices;
  await capture(cdp, "ru-event-1280", 1280, 720, false, true);
  await capture(cdp, "ru-event-mobile", 390, 844, true, true);

  report.consoleErrors = cdp.errors;
  if (cdp.errors.length > 0) throw new Error(cdp.errors.join("\n"));
  report.passed = true;
  const cards = screens.map((name) => `<figure><figcaption>${name}</figcaption><img src="${name}.png"></figure>`).join("");
  await writeFile(join(out, "contact.html"), `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f3ecdf;color:#343a45;font:18px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;padding:12px;background:#fffaf2;border:2px solid #b78b52;border-radius:12px}figcaption{padding-bottom:10px}img{display:block;width:100%;height:420px;object-fit:contain;background:#f8f3e9;border-radius:8px}</style><h1>Earth — RU/EN production QA</h1><main>${cards}</main>`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  report.consoleErrors = cdp?.errors ?? [];
  if (cdp) {
    report.failureState = await evaluate(cdp, `({ url: location.href, origin: location.origin, navigation: performance.getEntriesByType("navigation")[0]?.type, text: document.querySelector("#app")?.textContent?.slice(0, 2000), controller: Boolean(navigator.serviceWorker?.controller) })`).catch((diagnosticError) => String(diagnosticError));
    const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).catch(() => null);
    if (shot) await writeFile(join(out, "failure.png"), Buffer.from(String(shot.data), "base64"));
  }
  throw error;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  cdp?.close();
  if (chrome.exitCode === null) await new Promise((resolveExit) => {
    chrome.once("exit", resolveExit);
    chrome.kill();
  });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
