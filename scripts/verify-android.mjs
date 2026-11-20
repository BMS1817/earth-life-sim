import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const name = value("--name", "android");
const serial = value("--serial", "emulator-5554");
const base = value("--base", "http://127.0.0.1:5181/?seed=i18n-ui");
const offlineFile = value("--offline-file", "");
const adb = "C:\\Users\\Maxim\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const out = resolve(value("--out", `shots/${name}`));
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
function adbCall(...args) {
  const result = spawnSync(adb, ["-s", serial, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`adb ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}
async function waitFor(check, description, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await sleep(100);
  }
  throw new Error(`Timeout: ${description}`);
}
adbCall("reverse", "tcp:5181", "tcp:5181");
adbCall("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", base, "com.android.chrome");
adbCall("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
const target = await waitFor(async () => {
  try {
    const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
    return pages.find((page) => page.type === "page" && !page.url.startsWith("devtools://"));
  } catch {
    return null;
  }
}, "Android Chrome CDP", 60_000);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", rejectOpen, { once: true });
});
let nextId = 1;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id !== undefined) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result ?? {});
  } else if (message.method === "Runtime.exceptionThrown") errors.push(JSON.stringify(message.params));
});
function call(method, params = {}) {
  const id = nextId++;
  return new Promise((resolveCall, rejectCall) => {
    pending.set(id, { resolve: resolveCall, reject: rejectCall });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression, awaitPromise = false) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function tapText(text, exact = true) {
  const point = await evaluate(`(() => {
    const node = [...document.querySelectorAll("button")].find((item) => ${exact ? "item.textContent ===" : "item.textContent.includes"}(${JSON.stringify(text)}) && item.getBoundingClientRect().width > 0);
    if (!node) return null;
    node.scrollIntoView({ block: "center", inline: "center" });
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`No visible button: ${text}`);
  await evaluate(`(() => { const node = [...document.querySelectorAll("button")].find((item) => ${exact ? "item.textContent ===" : "item.textContent.includes"}(${JSON.stringify(text)}) && item.getBoundingClientRect().width > 0); node.click(); })()`);
}
async function capture(file) {
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, file), Buffer.from(String(shot.data), "base64"));
}
const report = { name, serial, passed: false, checks: {}, errors };
await mkdir(out, { recursive: true });
try {
  await Promise.all([call("Page.enable"), call("Runtime.enable"), call("Network.enable")]);
  await call("Page.bringToFront");
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.removeItem("earth:life:v10"); localStorage.setItem("earth:language", "en");` });
  await call("Page.navigate", { url: base });
  await waitFor(async () => await evaluate(`document.querySelector("#soften-start")`), "portrait welcome");
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  report.checks.viewport = await evaluate(`({ width: innerWidth, height: innerHeight, coarse: matchMedia("(pointer: coarse)").matches, portrait: matchMedia("(orientation: portrait)").matches, overflow: document.documentElement.scrollWidth > innerWidth })`);
  if (!report.checks.viewport.coarse || !report.checks.viewport.portrait || report.checks.viewport.overflow) throw new Error(`Bad portrait viewport: ${JSON.stringify(report.checks.viewport)}`);
  await capture("01-welcome-portrait.png");
  report.checks.englishWelcome = await evaluate(`document.querySelector("h1")?.textContent === "Before you begin"`);
  await evaluate(`localStorage.setItem("earth:language", "ru")`);
  await call("Page.reload", { ignoreCache: true });
  await sleep(400);
  await waitFor(async () => await evaluate(`document.readyState === "complete" && document.querySelector("#soften-start")`), "Russian welcome");
  await tapText("Начать новую жизнь");
  await waitFor(async () => await evaluate(`document.querySelector(".time-controls")`), "game start");
  await tapText("Прожить год");
  await waitFor(async () => await evaluate(`document.querySelectorAll(".event .choice button").length`) === 4, "four choices");
  report.checks.choices = 4;
  await tapText("Герой");
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "hero"`), "hero tab");
  report.checks.heroOverflow = await evaluate(`(() => { const rect = document.querySelector("canvas.scene").getBoundingClientRect(); return rect.left < 0 || rect.right > innerWidth; })()`);
  if (report.checks.heroOverflow) throw new Error("Hero canvas overflows");
  await tapText("Событие");
  const firstChoice = await evaluate(`document.querySelector(".event .choice button").textContent`);
  await tapText(firstChoice);
  await waitFor(async () => await evaluate(`document.querySelector(".outcome-inline")`), "choice outcome");
  report.checks.outcome = true;
  report.checks.saved = await evaluate(`Boolean(localStorage.getItem("earth:life:v10"))`);
  await capture("02-choice-portrait.png");
  await tapText("Меню");
  await tapText("Моменты ·", false);
  await waitFor(async () => await evaluate(`document.querySelector(".memorial-view")`), "life journal");
  report.checks.memorial = true;
  await capture("03-journal-portrait.png");
  await tapText("Назад");
  await waitFor(async () => await evaluate(`document.querySelector(".time-controls")`), "back to game");

  adbCall("shell", "settings", "put", "system", "accelerometer_rotation", "0");
  adbCall("shell", "settings", "put", "system", "user_rotation", "1");
  await sleep(800);
  await waitFor(async () => await evaluate(`matchMedia("(orientation: landscape)").matches && getComputedStyle(document.querySelector(".orientation-lock")).display === "flex"`), "landscape rotation overlay");
  report.checks.landscapeOverlay = await evaluate(`({ text: document.querySelector(".orientation-lock").textContent, width: innerWidth, height: innerHeight })`);
  await capture("04-rotate-overlay.png");
  adbCall("shell", "settings", "put", "system", "user_rotation", "0");
  await sleep(800);
  await waitFor(async () => await evaluate(`matchMedia("(orientation: portrait)").matches && getComputedStyle(document.querySelector(".orientation-lock")).display === "none"`), "portrait restored");
  adbCall("shell", "settings", "put", "system", "accelerometer_rotation", "1");
  report.checks.portraitRestored = true;

  if (offlineFile) {
    adbCall("push", offlineFile, "/sdcard/Download/earth-one-life-offline.html");
    adbCall("shell", "chmod", "0644", "/sdcard/Download/earth-one-life-offline.html");
    await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await call("Page.navigate", { url: "file:///sdcard/Download/earth-one-life-offline.html?seed=android-offline" });
    await waitFor(async () => await evaluate(`document.querySelector("#soften-start")`), "offline HTML welcome", 60_000);
    await tapText("Начать новую жизнь");
    await waitFor(async () => await evaluate(`document.querySelector(".time-controls")`), "offline HTML start");
    await tapText("Прожить год");
    await waitFor(async () => await evaluate(`document.querySelectorAll(".event .choice button").length`) === 4, "offline HTML choices");
    report.checks.offlineChoices = 4;
    await capture("05-offline-html.png");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  report.failureState = await evaluate(`({ url: location.href, width: innerWidth, height: innerHeight, text: document.body?.textContent?.slice(0, 1500) })`).catch((diagnosticError) => String(diagnosticError));
  throw error;
} finally {
  adbCall("shell", "settings", "put", "system", "user_rotation", "0");
  adbCall("shell", "settings", "put", "system", "accelerometer_rotation", "1");
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  socket.close();
}
