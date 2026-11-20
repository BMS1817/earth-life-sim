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
  await tapText("Начать новую жизнь");
  await waitText("Прожить год");
  report.checks.start = true;
  await tapText("Прожить год");
  await waitFor(async () => await evaluate(`document.querySelectorAll(".event .choice button").length`) === 4, "4 решения");
  report.checks.eventChoices = 4;
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
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, "touch-after-choice.png"), Buffer.from(String(shot.data), "base64"));
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
