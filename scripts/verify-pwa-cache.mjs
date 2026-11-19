import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : "http://127.0.0.1:4175/";
const outIndex = args.indexOf("--out");
const out = resolve(outIndex >= 0 ? args[outIndex + 1] : "shots/pwa-cache");
const executable = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find(existsSync);
if (!executable) throw new Error("Chrome не найден");
const profile = await mkdtemp(join(tmpdir(), "earth-pwa-cache-"));
const port = 10_000 + Math.floor(Math.random() * 20_000);
const chrome = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let socket;
const pending = new Map();
const errors = [];
let nextId = 1;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(100);
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
async function evaluate(expression, awaitPromise = false) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function status() {
  return evaluate(`(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const cachesInfo = [];
    for (const key of await caches.keys()) cachesInfo.push({ key, files: (await (await caches.open(key)).keys()).length });
    return {
      controller: Boolean(navigator.serviceWorker.controller),
      registrations: registrations.map((registration) => ({
        scope: registration.scope,
        installing: registration.installing?.state ?? null,
        waiting: registration.waiting?.state ?? null,
        active: registration.active?.state ?? null,
      })),
      caches: cachesInfo,
      status: document.querySelector(".offline-status")?.textContent ?? null,
    };
  })()`, true);
}
await mkdir(out, { recursive: true });
const report = { base, passed: false, samples: [], errors };
try {
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "запуск Chrome");
  socket = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json()).webSocketDebuggerUrl);
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
    } else if (message.method === "Runtime.exceptionThrown" || (message.method === "Log.entryAdded" && message.params?.entry?.level === "error")) errors.push(JSON.stringify(message.params));
  });
  await Promise.all([call("Page.enable"), call("Runtime.enable"), call("Log.enable")]);
  await call("Page.navigate", { url: base });
  await waitFor(async () => Boolean(await evaluate(`document.querySelector("#soften-start")`)), "стартовая страница");
  const deadline = Date.now() + 600_000;
  let ready = false;
  while (Date.now() < deadline) {
    const current = await status();
    report.samples.push(current);
    console.log(JSON.stringify(current));
    const expected = await evaluate(`(async () => (await (await fetch("sw-assets.json")).json()).length)()`, true);
    if (current.controller && current.caches.some((cache) => cache.key.startsWith("earth-v1.0.0-") && cache.files >= expected)) {
      ready = true;
      break;
    }
    await sleep(10_000);
  }
  if (!ready) throw new Error("Оффлайн-кэш не готов за 10 минут");
  await call("Network.enable");
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await call("Page.reload", { ignoreCache: true });
  await sleep(500);
  await waitFor(async () => Boolean(await evaluate(`location.origin === ${JSON.stringify(new URL(base).origin)} && document.readyState === "complete" && navigator.serviceWorker.controller && document.querySelector("#soften-start")`)), "оффлайн-перезагрузка");
  report.passed = true;
  console.log("Оффлайн-перезагрузка прошла");
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
