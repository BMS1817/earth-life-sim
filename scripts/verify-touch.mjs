import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : "http://127.0.0.1:4175/?seed=touch-production";
const out = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : "shots/touch-production");
const executable = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find(existsSync);
if (!executable) throw new Error("Chrome не найден");
const profile = await mkdtemp(join(tmpdir(), "earth-touch-"));
const port = 10_000 + Math.floor(Math.random() * 20_000);
const chrome = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let socket;
let nextId = 1;
const pending = new Map();
const errors = [];
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, description) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(50);
  }
  throw new Error(`Таймаут: ${description}`);
}
function call(method, params = {}) {
  const id = nextId++;
  return new Promise((resolveCall, rejectCall) => {
    pending.set(id, { resolve: resolveCall, reject: rejectCall });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function waitText(text) {
  await waitFor(async () => await evaluate(`document.body?.textContent.includes(${JSON.stringify(text)}) ?? false`), text);
}
async function tapText(text, exact = true) {
  const point = await evaluate(`(() => {
    const node = [...document.querySelectorAll("button")].find((item) => ${exact ? "item.textContent ===" : "item.textContent.includes"}(${JSON.stringify(text)}) && item.getBoundingClientRect().width > 0);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`Нет видимой кнопки: ${text}`);
  await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
  await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function key(key, code, windowsVirtualKeyCode) {
  await call("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
}
await mkdir(out, { recursive: true });
const report = { base, passed: false, checks: {}, errors };
try {
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== undefined) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result ?? {});
    } else if (message.method === "Runtime.exceptionThrown" || (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error")) errors.push(JSON.stringify(message.params));
  });
  await Promise.all([call("Page.enable"), call("Runtime.enable")]);
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await call("Page.navigate", { url: base });
  await waitText("Начать новую жизнь");
  const contrast = await evaluate(`(() => {
    const rgb = (value) => value.match(/[\\d.]+/g).slice(0, 3).map(Number);
    const luminance = (value) => rgb(value).map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const background = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor;
        if (color && !color.endsWith(", 0)") && color !== "transparent") return color;
      }
      return "rgb(255, 255, 255)";
    };
    const ratio = (node) => {
      const values = [luminance(getComputedStyle(node).color), luminance(background(node))].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    return { h1: ratio(document.querySelector("h1")), h2: ratio(document.querySelector("h2")), link: ratio(document.querySelector("a")) };
  })()`);
  if (Object.values(contrast).some((value) => value < 4.5)) throw new Error(`Контраст ниже 4.5: ${JSON.stringify(contrast)}`);
  report.checks.contrast = contrast;
  await tapText("Начать новую жизнь");
  await waitText("Прожить год");
  report.checks.start = true;
  await tapText("Прожить год");
  await waitFor(async () => await evaluate(`document.querySelectorAll(".event .choice button").length`) === 4, "4 решения");
  report.checks.eventChoices = 4;
  await evaluate(`document.getElementById("tab-event").focus()`);
  await key("ArrowRight", "ArrowRight", 39);
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "hero" && document.activeElement?.id === "tab-hero" && document.getElementById("tab-hero").getAttribute("aria-selected") === "true" && document.getElementById("tab-hero").tabIndex === 0`), "ArrowRight и фокус героя");
  await key("End", "End", 35);
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "menu" && document.activeElement?.id === "tab-menu"`), "End и вкладка меню");
  await key("Enter", "Enter", 13);
  await waitFor(async () => await evaluate(`document.activeElement?.id === "tab-menu" && document.querySelector(".game-shell")?.dataset.active === "menu"`), "Enter сохраняет вкладку и фокус");
  await key("Home", "Home", 36);
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "event" && document.activeElement?.id === "tab-event"`), "Home и вкладка события");
  await key("ArrowLeft", "ArrowLeft", 37);
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "menu" && document.activeElement?.id === "tab-menu"`), "ArrowLeft с циклическим переходом");
  await key(" ", "Space", 32);
  await waitFor(async () => await evaluate(`document.activeElement?.id === "tab-menu" && document.querySelector(".game-shell")?.dataset.active === "menu"`), "Space сохраняет вкладку и фокус");
  await key("Home", "Home", 36);
  report.checks.keyboardTabs = true;
  await tapText("Герой");
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "hero"`), "вкладка героя");
  const heroOverflow = await evaluate(`(() => { const rect=document.querySelector("canvas.scene").getBoundingClientRect(); return rect.left < 0 || rect.right > innerWidth; })()`);
  if (heroOverflow) throw new Error("Сцена героя выходит за экран");
  report.checks.hero = true;
  await tapText("Событие");
  await waitFor(async () => await evaluate(`document.querySelector(".game-shell")?.dataset.active === "event"`), "вкладка события");
  const firstChoice = await evaluate(`document.querySelector(".event .choice button").textContent`);
  await tapText(firstChoice);
  await waitText("Итог решения");
  report.checks.choiceOutcome = true;
  await evaluate(`(() => { window.__earthOriginalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === "earth:life:v10") throw new Error("storage full"); return window.__earthOriginalSetItem.call(this, key, value); }; })()`);
  await tapText("Герой");
  await waitFor(async () => await evaluate(`(() => { const alert=document.querySelector(".save-alerts [role=alert]"); const exportButton=[...document.querySelectorAll(".save-alerts button")].find((node) => node.textContent === "Экспорт сейва"); return alert?.getBoundingClientRect().height > 0 && exportButton?.getBoundingClientRect().height > 0; })()`), "видимая ошибка записи и экспорт на вкладке героя");
  report.checks.saveWriteError = true;
  await evaluate(`(() => { Storage.prototype.setItem = window.__earthOriginalSetItem; delete window.__earthOriginalSetItem; })()`);
  await tapText("Событие");
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, "touch-after-choice.png"), Buffer.from(String(shot.data), "base64"));
  await call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await call("Emulation.setDeviceMetricsOverride", { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
  await sleep(200);
  const compactLayout = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth, overlay: getComputedStyle(document.querySelector(".orientation-lock")).display, tabs: getComputedStyle(document.querySelector(".bottom-tabs")).display })`);
  if (compactLayout.overflow || compactLayout.overlay !== "none" || compactLayout.tabs !== "grid") throw new Error(`Проблема ширины 960: ${JSON.stringify(compactLayout)}`);
  report.checks.compact960 = compactLayout;
  const compactShot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, "compact-960.png"), Buffer.from(String(compactShot.data), "base64"));
  if (errors.length > 0) throw new Error(errors.join("\n"));
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  socket?.close();
  if (chrome.exitCode === null) await new Promise((resolveExit) => {
    chrome.once("exit", resolveExit);
    chrome.kill();
  });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
