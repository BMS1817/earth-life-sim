import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.paused = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
      } else if (message.method === "Fetch.requestPaused") {
        this.paused.push(message.params);
      }
    });
  }
  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("CDP WebSocket error")), { once: true });
    });
    return new Cdp(socket);
  }
  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true });
  return result.result?.value;
}

async function waitFor(check, description) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Таймаут: ${description}`);
}

async function clickButton(cdp, text) {
  const clicked = await evaluate(cdp, `(() => { const b = [...document.querySelectorAll("button")].find((node) => node.textContent.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
  if (!clicked) throw new Error(`Кнопка не найдена: ${text}`);
}

async function state(cdp) {
  const raw = await evaluate(cdp, `localStorage.getItem("earth:life:v10")`);
  if (!raw) throw new Error("Сейв не найден");
  return JSON.parse(String(raw));
}

async function advanceToAge(cdp, targetAge) {
  for (let step = 0; step < 5000; step++) {
    const current = await state(cdp);
    if (current.age >= targetAge) return;
    const action = await evaluate(cdp, `(() => {
      const choice = document.querySelector(".choice button");
      if (choice) { choice.click(); return "choice"; }
      const skip = [...document.querySelectorAll("button")].find((node) => node.textContent === "До следующего решения");
      if (skip) { skip.click(); return "skip"; }
      return "waiting";
    })()`);
    if (action === "waiting") throw new Error("Нет действия");
    await new Promise((resolveWait) => setTimeout(resolveWait, 8));
  }
  throw new Error("Слишком много действий");
}

async function colors(cdp) {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector("canvas.scene");
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const result = new Set();
    for (let i = 0; i < data.length; i += 4) result.add([...data.slice(i, i + 4)].join(","));
    return result.size;
  })()`);
}

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
if (!chrome) throw new Error("Chrome не найден");
const profile = await mkdtemp(join(tmpdir(), "earth-scene-repro-"));
const port = 9700 + Math.floor(Math.random() * 200);
const process = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let cdp;
try {
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
  }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.call("Page.navigate", { url: "http://127.0.0.1:4175/?seed=scene-loading-repro" });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("#soften-start"))`), "старт");
  await clickButton(cdp, "Начать новую жизнь");
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".time-controls"))`), "игра");
  await advanceToAge(cdp, 12);
  await cdp.call("Runtime.evaluate", {
    expression: `(async () => {
      for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
      for (const key of await caches.keys()) await caches.delete(key);
    })()`,
    awaitPromise: true,
  });
  await cdp.call("Network.enable");
  await cdp.call("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `delete Navigator.prototype.serviceWorker;` });
  await cdp.call("Page.reload", { ignoreCache: true });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".time-controls"))`), "игра без оффлайн-кэша");
  await waitFor(async () => (await colors(cdp)) > 10, "полный кадр перед переходом");
  if ((await state(cdp)).age !== 12) throw new Error("Переход 12→13 уже произошёл до задержки");
  await waitFor(async () => {
    const frame = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
    return evaluate(cdp, `(() => { const same = window.__sceneFrame === ${JSON.stringify(frame)}; window.__sceneStable = same ? (window.__sceneStable ?? 0) + 1 : 0; window.__sceneFrame = ${JSON.stringify(frame)}; return window.__sceneStable >= 8; })()`);
  }, "стабильный кадр перед переходом");
  const previousFrame = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
  const previous = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(resolve("shots/scene-loading-previous.png"), Buffer.from(previous.data, "base64"));
  await writeFile(resolve("shots/scene-loading-previous-canvas.png"), Buffer.from(previousFrame.split(",")[1], "base64"));
  await cdp.call("Fetch.enable", { patterns: [{ urlPattern: "*_03_teen*", requestStage: "Request" }] });
  await advanceToAge(cdp, 13);
  await waitFor(async () => cdp.paused.length >= 2, "задержка спрайтов подростка");
  const pendingFrame = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  const blankColors = await colors(cdp);
  const blankFrame = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
  const blank = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(resolve("shots/scene-loading-blank.png"), Buffer.from(blank.data, "base64"));
  await writeFile(resolve("shots/scene-loading-blank-canvas.png"), Buffer.from(blankFrame.split(",")[1], "base64"));
  for (const request of cdp.paused) await cdp.call("Fetch.continueRequest", { requestId: request.requestId });
  await waitFor(async () => (await colors(cdp)) > 10, "восстановление сцены");
  const restoredColors = await colors(cdp);
  const restoredFrame = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
  const restored = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(resolve("shots/scene-loading-restored.png"), Buffer.from(restored.data, "base64"));
  await writeFile(resolve("shots/scene-loading-restored-canvas.png"), Buffer.from(restoredFrame.split(",")[1], "base64"));
  console.log(JSON.stringify({ age: (await state(cdp)).age, blankColors, restoredColors, pendingFramePreserved: blankFrame === pendingFrame, pausedRequests: cdp.paused.map((request) => request.request.url) }));
  if (blankColors <= 2) throw new Error(`Сцена потеряна во время загрузки: ${blankColors} цвета`);
  if (blankFrame !== pendingFrame) throw new Error("Кадр изменился во время загрузки обязательных слоёв");
} finally {
  cdp?.socket.close();
  if (process.exitCode === null) await new Promise((resolveExit) => { process.once("exit", resolveExit); process.kill(); });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
