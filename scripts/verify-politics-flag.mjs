import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.id = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
    });
  }
  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    return new Cdp(socket);
  }
  call(method, params = {}) {
    const id = this.id++;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function waitFor(check, description) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 80));
  }
  throw new Error(`Таймаут: ${description}`);
}

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
if (!chrome) throw new Error("Chrome не найден");
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "http://127.0.0.1:4173/?seed=politics-flag";
const profile = await mkdtemp(join(tmpdir(), "earth-politics-flag-"));
const port = 9700 + Math.floor(Math.random() * 200);
const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let cdp;
const out = resolve("shots/politics-flag");
await mkdir(out, { recursive: true });
try {
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
  }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.call("Page.navigate", { url: base });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("#soften-start"))`), "старт");
  await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent.includes("Начать новую жизнь"))?.click()`);
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".time-controls"))`), "игра");
  await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent.includes("Политика"))?.click()`);
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".politics-scene"))`), "politics");
  const report = await evaluate(cdp, `(async () => {
    const state = JSON.parse(localStorage.getItem("earth:life:v10"));
    const flag = document.querySelector(".politics-flag");
    const style = flag ? getComputedStyle(flag) : null;
    const sceneRect = document.querySelector(".politics-scene").getBoundingClientRect();
    const rect = flag?.getBoundingClientRect();
    const result = { iso2: state.birth.country.iso2, iso3: state.birth.country.iso3, exists: Boolean(flag), className: flag?.className, display: style?.display, position: style?.position, backgroundImage: style?.backgroundImage, rect: rect?.toJSON(), expectedWidth: innerWidth <= 700 ? 36 : 48, withinScene: Boolean(rect && rect.top >= sceneRect.top && rect.right <= sceneRect.right && rect.bottom <= sceneRect.bottom) };
    if (style && style.backgroundImage !== "none") {
      const url = style.backgroundImage.slice(5, -2);
      const response = await fetch(url);
      result.fetch = { status: response.status, type: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength };
    }
    return result;
  })()`);
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, "politics-flag.png"), Buffer.from(String(shot.data), "base64"));
  await waitFor(async () => Boolean(await evaluate(cdp, `(async () => {
    const assets = await (await fetch("sw-assets.json")).json();
    const key = (await caches.keys()).find((name) => name.startsWith("earth-v1.0.0-"));
    if (!key) return false;
    const cache = await caches.open(key);
    return (await cache.keys()).length >= assets.length;
  })()`)), "оффлайн-кэш");
  await cdp.call("Page.reload", { ignoreCache: true });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".time-controls"))`), "online reload");
  await evaluate(cdp, `(async () => { await navigator.serviceWorker.ready; return true; })()`);
  await cdp.call("Page.navigate", { url: base });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".time-controls"))`), "controlled screen");
  const controlled = await evaluate(cdp, `(async () => ({ controller: navigator.serviceWorker.controller !== null, registrations: (await navigator.serviceWorker.getRegistrations()).map((item) => ({ scope: item.scope, active: Boolean(item.active) })), location: location.href }))()`);
  if (!controlled.controller) throw new Error(`Нет управляющего service worker: ${JSON.stringify(controlled)}`);
  await cdp.call("Network.enable");
  await cdp.call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp.call("Page.navigate", { url: base });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".time-controls"))`), "offline reload");
  await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent.includes("Политика"))?.click()`);
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector(".politics-flag"))`), "offline politics");
  report.offline = await evaluate(cdp, `(() => { const flag = document.querySelector(".politics-flag"); const style = getComputedStyle(flag); const rect = flag.getBoundingClientRect(); return { exists: true, position: style.position, width: rect.width, localSvg: style.backgroundImage.includes("/flags/4x3/"), controller: navigator.serviceWorker.controller !== null, online: navigator.onLine }; })()`);
  await cdp.call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, backgroundImage: report.backgroundImage === "none" ? "none" : "local SVG loaded" }, null, 2));
  if (report.iso2 && (!report.exists || report.position !== "absolute" || !report.withinScene || report.rect?.width !== report.expectedWidth || !report.backgroundImage || report.backgroundImage === "none" || report.fetch?.status !== 200 || !report.offline.localSvg || !report.offline.controller || report.offline.online)) process.exitCode = 1;
} finally {
  cdp?.socket.close();
  if (browser.exitCode === null) await new Promise((resolveExit) => { browser.once("exit", resolveExit); browser.kill(); });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
