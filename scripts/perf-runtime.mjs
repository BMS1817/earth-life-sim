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
const out = resolve(value("--out", "shots/perf-runtime-baseline"));
const mobile = args.includes("--mobile");
const cycles = Number(value("--cycles", "10"));
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
    await Promise.all([cdp.call("Page.enable"), cdp.call("Runtime.enable"), cdp.call("Performance.enable"), cdp.call("HeapProfiler.enable")]);
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
    await sleep(12);
  }
  throw new Error(`Таймаут: ${description}`);
}
async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function clickButton(cdp, text) {
  const clicked = await evaluate(cdp, `(() => { const button = [...document.querySelectorAll("button")].find((node) => node.textContent.includes(${JSON.stringify(text)})); if (!button) return false; button.click(); return true; })()`);
  if (!clicked) throw new Error(`Кнопка не найдена: ${text}`);
}
async function waitSelector(cdp, selector) {
  await waitFor(async () => Boolean(await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})`)), selector);
}
async function savedState(cdp) {
  const raw = await evaluate(cdp, `localStorage.getItem("earth:life:v10")`);
  if (!raw) throw new Error("Сейв не найден");
  return JSON.parse(String(raw));
}
async function playToEnd(cdp) {
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
    await sleep(8);
  }
  throw new Error("Жизнь не завершилась за 5000 действий");
}
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}
async function measureAction(cdp, name, buttonText, selector) {
  const result = await evaluate(cdp, `new Promise((resolve) => {
    const button = ${JSON.stringify(buttonText)}.startsWith("data-tab=")
      ? document.querySelector('.mobile-tabs button[' + ${JSON.stringify(buttonText)} + ']')
      : ${JSON.stringify(buttonText)} === ""
        ? document.querySelector(".inheritance-heir")
        : [...document.querySelectorAll("button")].find((node) => node.textContent.includes(${JSON.stringify(buttonText)}));
    if (!button) { resolve({ ms: 0, ok: false }); return; }
    const started = performance.now();
    button.click();
    const target = ${JSON.stringify(buttonText)} === "" ? ".time-controls" : ${JSON.stringify(selector)};
    requestAnimationFrame(() => resolve({ ms: performance.now() - started, ok: Boolean(document.querySelector(target)) }));
  })`, true);
  if (!result.ok) throw new Error(`Действие не привело к ${selector}: ${name}`);
  return { name, ms: result.ms };
}
async function measureFrames(cdp, duration = 5000) {
  const intervals = await evaluate(cdp, `new Promise((resolve) => {
    const intervals = [];
    let previous = 0;
    let started = 0;
    function frame(time) {
      if (!started) started = time;
      if (previous) intervals.push(time - previous);
      previous = time;
      if (time - started >= ${duration}) resolve(intervals);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })`, true);
  return {
    samples: intervals.length,
    meanMs: intervals.reduce((sum, item) => sum + item, 0) / intervals.length,
    p95Ms: percentile(intervals, 0.95),
    maxMs: Math.max(...intervals),
    fps: 1000 / (intervals.reduce((sum, item) => sum + item, 0) / intervals.length),
    overBudget: intervals.filter((item) => item > (mobile ? 33.3 : 16.7)).length,
  };
}
async function memory(cdp, cycle) {
  await sleep(150);
  await cdp.call("HeapProfiler.collectGarbage");
  await sleep(50);
  await cdp.call("HeapProfiler.collectGarbage");
  await sleep(50);
  const result = await cdp.call("Performance.getMetrics");
  const metrics = Object.fromEntries(result.metrics.map((item) => [item.name, item.value]));
  const timers = await evaluate(cdp, `window.__earthPerfTimers ? window.__earthPerfTimers.size : null`);
  const screen = await evaluate(cdp, `({ appClass: document.querySelector("#app").className, heading: document.querySelector("#app h1")?.textContent, welcome: Boolean(document.querySelector("#soften-start")), memorial: Boolean(document.querySelector(".memorial-view")), main: Boolean(document.querySelector(".time-controls")) })`);
  return { cycle, heap: metrics.JSHeapUsedSize, nodes: metrics.Nodes, listeners: metrics.JSEventListeners, documents: metrics.Documents, timers, screen };
}

const executable = [
  process.env.CHROME_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
if (!executable) throw new Error("Chrome не найден");
const profile = await mkdtemp(join(tmpdir(), "earth-perf-runtime-"));
const port = 10_000 + Math.floor(Math.random() * 20_000);
const chrome = spawn(executable, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let cdp;
await mkdir(out, { recursive: true });
const report = { base, device: mobile ? "mobile" : "desktop", createdAt: new Date().toISOString(), ordinary: [], heavy: [], memory: [], thresholds: { fps: mobile ? 30 : 60, frameP95Ms: mobile ? 33.3 : 16.7, ordinaryP95Ms: 100, heavyP95Ms: 200, heapGrowth: 0.1 }, passed: true };
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
  await cdp.call("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1280, height: mobile ? 844 : 720, deviceScaleFactor: 1, mobile });
  await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const active = new Set();
    window.__earthPerfTimers = active;
    const originalTimeout = window.setTimeout.bind(window);
    const originalInterval = window.setInterval.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      let id;
      id = originalTimeout(() => { active.delete(id); callback(...args); }, delay);
      active.add(id);
      return id;
    };
    window.setInterval = (callback, delay, ...args) => {
      const id = originalInterval(callback, delay, ...args);
      active.add(id);
      return id;
    };
    window.clearTimeout = (id) => { active.delete(id); originalClearTimeout(id); };
    window.clearInterval = (id) => { active.delete(id); originalClearInterval(id); };
  })();` });
  const url = new URL(base);
  url.searchParams.set("seed", "turn-inheritance-0");
  await cdp.call("Page.navigate", { url: url.href });
  await waitSelector(cdp, "#soften-start");
  await clickButton(cdp, "Начать новую жизнь");
  await waitSelector(cdp, ".time-controls");
  await waitSelector(cdp, ".game-shell");
  report.frames = await measureFrames(cdp);
  console.log(JSON.stringify({ frames: report.frames }));
  if (mobile) {
    for (let index = 0; index < 12; index++) {
      const tab = ["hero", "focus", "menu", "event"][index % 4];
      report.ordinary.push(await measureAction(cdp, `tab-${tab}`, `data-tab="${tab}"`, `.game-shell[data-active="${tab}"]`));
    }
  }
  for (const [name, text, selector, heavy] of [
    ["people", "Люди", ".people-view", false],
    ["finance", "Деньги", ".finance-view", false],
    ["lifestyle", "Образ жизни", ".lifestyle-view", false],
    ["politics", "Политика", ".politics-view", false],
    ["lineage", "Род ·", ".lineage-view", false],
    ["memorial", "Моменты ·", ".memorial-view", true],
  ]) {
    for (let index = 0; index < 5; index++) {
      (heavy ? report.heavy : report.ordinary).push(await measureAction(cdp, name, text, selector));
      report.ordinary.push(await measureAction(cdp, `${name}-back`, "Назад", ".time-controls"));
    }
  }
  await playToEnd(cdp);
  await waitSelector(cdp, ".memorial-view.ended");
  for (let index = 0; index < 3; index++) {
    const result = await evaluate(cdp, `new Promise((resolve) => {
      const summary = document.querySelector(".gifted-day summary");
      const details = document.querySelector(".gifted-day");
      if (details.open) details.open = false;
      const started = performance.now();
      summary.click();
      requestAnimationFrame(() => resolve({ ms: performance.now() - started, ok: details.open }));
    })`, true);
    if (!result.ok) throw new Error("Подаренный день не открылся");
    report.heavy.push({ name: "gifted-day", ms: result.ms });
  }
  report.generations = [1];
  for (const generation of [2, 3]) {
    report.heavy.push(await measureAction(cdp, `inherit-${generation}`, "", ".inheritance-heir"));
    await waitSelector(cdp, ".time-controls");
    const state = await savedState(cdp);
    if (state.lineage.generation !== generation) throw new Error(`Поколение: ${state.lineage.generation}`);
    report.generations.push(generation);
    await playToEnd(cdp);
  }
  await clickButton(cdp, "Ещё одна жизнь");
  await waitSelector(cdp, "#soften-start");
  report.memory.push(await memory(cdp, 0));
  for (let cycle = 1; cycle <= cycles; cycle++) {
    await clickButton(cdp, "Начать новую жизнь");
    await waitSelector(cdp, ".time-controls");
    await playToEnd(cdp);
    await clickButton(cdp, "Ещё одна жизнь");
    await waitSelector(cdp, "#soften-start");
    report.memory.push(await memory(cdp, cycle));
    console.log(JSON.stringify({ memory: report.memory.at(-1) }));
  }
  report.ordinaryP95Ms = percentile(report.ordinary.map((item) => item.ms), 0.95);
  report.heavyP95Ms = percentile(report.heavy.map((item) => item.ms), 0.95);
  const stable = report.memory.slice(-3);
  report.heapGrowth = stable.length >= 2 ? (stable.at(-1).heap - stable[0].heap) / stable[0].heap : 0;
  report.listenerGrowth = report.memory.length >= 2 ? report.memory.at(-1).listeners - report.memory[0].listeners : 0;
  report.nodeGrowth = report.memory.length >= 2 ? report.memory.at(-1).nodes - report.memory[0].nodes : 0;
  report.timerGrowth = report.memory.length >= 2 ? report.memory.at(-1).timers - report.memory[0].timers : 0;
  await cdp.call("DOM.enable");
  const detached = await cdp.call("DOM.getDetachedDomNodes");
  report.retainedScreens = detached.detachedNodes.filter((item) => {
    const attributes = item.treeNode?.attributes ?? [];
    const classIndex = attributes.indexOf("class");
    const className = classIndex >= 0 ? attributes[classIndex + 1] : "";
    return /(?:^| )(?:memorial-view|game-shell)(?: |$)/.test(className);
  }).length;
  if (args.includes("--detached")) report.detached = detached;
  report.errors = cdp.errors;
  report.failures = [];
  if (report.frames.fps < (mobile ? 30 : 59.5)) report.failures.push(`fps ${report.frames.fps}`);
  if (report.frames.p95Ms > (mobile ? 33.3 : 16.7) + 0.1) report.failures.push(`frame p95 ${report.frames.p95Ms}`);
  if (report.ordinaryP95Ms > 100) report.failures.push(`ordinary p95 ${report.ordinaryP95Ms}`);
  if (report.heavyP95Ms > 200) report.failures.push(`heavy p95 ${report.heavyP95Ms}`);
  if (report.heapGrowth > 0.1) report.failures.push(`heap growth ${report.heapGrowth}`);
  if (report.listenerGrowth > 0 || report.timerGrowth > 0 || report.retainedScreens > 0) report.failures.push(`retained objects: listeners ${report.listenerGrowth}, screens ${report.retainedScreens}, timers ${report.timerGrowth}`);
  if (report.errors.length > 0) report.failures.push("console errors");
  report.passed = report.failures.length === 0;
} catch (error) {
  report.fatalError = String(error);
  report.passed = false;
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
console.log(JSON.stringify({ ordinaryP95Ms: report.ordinaryP95Ms, heavyP95Ms: report.heavyP95Ms, heapGrowth: report.heapGrowth, passed: report.passed, failures: report.failures }));
console.log(`Отчёт: ${join(out, "report.json")}`);
if (assert && !report.passed) throw new Error("Производительность runtime ниже цели");
