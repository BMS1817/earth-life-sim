import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const out = resolve("shots/itch-preview");
const executable = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find(existsSync);
if (!executable) throw new Error("Chrome not found");
const profile = await mkdtemp(join(tmpdir(), "earth-itch-preview-"));
const port = 10_000 + Math.floor(Math.random() * 20_000);
const chrome = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, description) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(60);
  }
  throw new Error(`Timeout: ${description}`);
}
let socket;
let nextId = 1;
const pending = new Map();
const errors = [];
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
const report = { passed: false, layouts: [], consoleErrors: errors };
await mkdir(out, { recursive: true });
try {
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
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
  await call("Page.navigate", { url: "http://127.0.0.1:5180/itch-preview.html" });
  await waitFor(async () => await evaluate(`document.readyState === "complete" && [...document.images].every((image) => image.complete && image.naturalWidth > 0)`), "all images");
  for (const [name, width, height, mobile] of [["1920", 1920, 1080, false], ["1440", 1440, 1080, false], ["1280", 1280, 720, false], ["mobile", 390, 844, true]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await sleep(250);
    const layout = await evaluate(`({ name: ${JSON.stringify(name)}, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src) })`);
    report.layouts.push(layout);
    if (layout.scrollWidth > width || layout.brokenImages.length > 0) throw new Error(`Layout failed: ${JSON.stringify(layout)}`);
    const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(join(out, `${name}-top.png`), Buffer.from(String(shot.data), "base64"));
    if (name === "1440" || name === "mobile") {
      const full = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(join(out, `${name}-full.png`), Buffer.from(String(full.data), "base64"));
    }
  }
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
