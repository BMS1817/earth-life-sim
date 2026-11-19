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
const out = resolve(value("--out", "shots/perf-startup-baseline"));
const runCount = Number(value("--runs", "3"));
const assert = args.includes("--assert");

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
    });
  }

  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("CDP WebSocket error")), { once: true });
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

function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("Chrome не найден; задайте CHROME_BIN");
  return executable;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(20);
  }
  throw new Error(`Таймаут: ${description}`);
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function network(cdp, mobile, offline = false) {
  await cdp.call("Network.enable");
  await cdp.call("Network.emulateNetworkConditions", {
    offline,
    latency: mobile ? 100 : 0,
    downloadThroughput: mobile ? 500_000 : -1,
    uploadThroughput: mobile ? 250_000 : -1,
  });
}

async function measureStartup(cdp, url, mode) {
  const errorsBefore = cdp.errors.length;
  const navigationStarted = Date.now();
  await cdp.call("Page.navigate", { url });
  await waitFor(async () => Boolean(await evaluate(cdp, `document.readyState === "complete" && document.querySelector("#soften-start")`)), `${mode}: welcome`);
  const welcomeMs = Date.now() - navigationStarted;
  const startClickedAt = Date.now();
  const clicked = await evaluate(cdp, `(() => { const button = [...document.querySelectorAll("button")].find((node) => node.textContent.includes("Начать новую жизнь")); if (!button) return false; button.click(); return true; })()`);
  if (!clicked) throw new Error(`${mode}: кнопка начала не найдена`);
  await waitFor(async () => Boolean(await evaluate(cdp, `document.querySelector(".time-controls")`)), `${mode}: interactive`);
  const interactiveMs = welcomeMs + Date.now() - startClickedAt;
  const timing = await evaluate(cdp, `(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      navigation: navigation ? {
        domContentLoaded: navigation.domContentLoadedEventEnd,
        load: navigation.loadEventEnd,
        responseEnd: navigation.responseEnd,
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
      } : null,
      resourceCount: resources.length,
      transferSize: resources.reduce((sum, item) => sum + item.transferSize, 0),
      encodedBodySize: resources.reduce((sum, item) => sum + item.encodedBodySize, 0),
      slowest: resources.map((item) => ({ name: item.name, duration: item.duration, transferSize: item.transferSize, encodedBodySize: item.encodedBodySize })).sort((a, b) => b.duration - a.duration).slice(0, 20),
    };
  })()`);
  return { mode, welcomeMs, interactiveMs, errors: cdp.errors.slice(errorsBefore), ...timing };
}

async function waitForOffline(cdp, navigationStarted) {
  await waitFor(async () => evaluate(cdp, `(async () => {
    if (!navigator.serviceWorker) return false;
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.some((item) => item.active)) return false;
    const response = await fetch("sw-assets.json");
    if (!response.ok) return false;
    const expected = (await response.json()).length;
    let stored = 0;
    for (const key of await caches.keys()) {
      if (!key.startsWith("earth-")) continue;
      stored += (await (await caches.open(key)).keys()).length;
    }
    return stored >= expected;
  })()`, true), "полная подготовка оффлайн-кэша", 240_000);
  return Date.now() - navigationStarted;
}

async function launch(profile, port, mobile) {
  const chrome = spawn(chromePath(), [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "запуск Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: mobile ? 390 : 1280,
    height: mobile ? 844 : 720,
    deviceScaleFactor: 1,
    mobile,
  });
  return { chrome, cdp };
}

function urlWithSeed(seed) {
  const url = new URL(base);
  url.searchParams.set("seed", seed);
  return url.href;
}

async function stop(chrome, cdp, profile) {
  cdp?.close();
  if (chrome.exitCode === null) await new Promise((resolveExit) => {
    chrome.once("exit", resolveExit);
    chrome.kill();
  });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

await mkdir(out, { recursive: true });
const report = { base, runs: runCount, createdAt: new Date().toISOString(), measurements: [], thresholds: { welcomeMs: 2000, interactiveMs: 2000, cacheReadyMs: 180_000 }, passed: true };
try {
  for (const mobile of [true, false]) {
    for (let run = 1; run <= runCount; run++) {
      const profile = await mkdtemp(join(tmpdir(), "earth-perf-startup-"));
      const port = 10_000 + Math.floor(Math.random() * 20_000);
      let chrome;
      let cdp;
      try {
        ({ chrome, cdp } = await launch(profile, port, mobile));
        if (args.includes("--no-sw")) {
          await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `delete Navigator.prototype.serviceWorker;` });
        }
        await network(cdp, mobile);
        await cdp.call("Network.setCacheDisabled", { cacheDisabled: true });
        const coldStarted = Date.now();
        const cold = await measureStartup(cdp, urlWithSeed(`perf-${mobile ? "mobile" : "desktop"}-cold-${run}`), `${mobile ? "mobile" : "desktop"}-cold-${run}`);
        if (!args.includes("--no-sw")) cold.cacheReadyMs = await waitForOffline(cdp, coldStarted);
        report.measurements.push(cold);
        console.log(JSON.stringify({ mode: cold.mode, welcomeMs: cold.welcomeMs, interactiveMs: cold.interactiveMs, cacheReadyMs: cold.cacheReadyMs }));
        if (args.includes("--cold-only")) continue;
        await cdp.call("Network.setCacheDisabled", { cacheDisabled: false });
        const warm = await measureStartup(cdp, urlWithSeed(`perf-${mobile ? "mobile" : "desktop"}-warm-${run}`), `${mobile ? "mobile" : "desktop"}-warm-${run}`);
        report.measurements.push(warm);
        console.log(JSON.stringify({ mode: warm.mode, welcomeMs: warm.welcomeMs, interactiveMs: warm.interactiveMs }));
        if (mobile) {
          await network(cdp, true, true);
          const offline = await measureStartup(cdp, urlWithSeed(`perf-mobile-offline-${run}`), `mobile-offline-${run}`);
          report.measurements.push(offline);
          console.log(JSON.stringify({ mode: offline.mode, welcomeMs: offline.welcomeMs, interactiveMs: offline.interactiveMs }));
          await network(cdp, true, false);
        }
      } finally {
        if (cdp) await network(cdp, mobile, false).catch(() => {});
        if (chrome) await stop(chrome, cdp, profile);
        else await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    }
  }
  report.failures = report.measurements.flatMap((item) => {
    const failures = [];
    if (item.mode.includes("cold") || item.mode.includes("warm")) {
      if (item.mode.startsWith("mobile") && item.welcomeMs >= 2000) failures.push(`${item.mode}: welcome ${item.welcomeMs} ms`);
      if (item.mode.startsWith("mobile") && item.interactiveMs >= 2000) failures.push(`${item.mode}: interactive ${item.interactiveMs} ms`);
    }
    if (item.cacheReadyMs >= 180_000) failures.push(`${item.mode}: cache ${item.cacheReadyMs} ms`);
    if (item.errors.length > 0) failures.push(`${item.mode}: console errors`);
    return failures;
  });
  report.passed = report.failures.length === 0;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(`Отчёт: ${join(out, "report.json")}`);
if (assert && !report.passed) throw new Error(`Производительность ниже цели:\n${report.failures.join("\n")}`);
