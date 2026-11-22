import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const out = resolve("shots/windows-e2e");
const downloads = resolve(".tools/windows-test-user/Downloads");
const port = Number(process.env.EARTH_WINDOWS_CDP ?? 19001);
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await sleep(60);
  }
  throw new Error(`Timeout: ${description}`);
}
const targets = await waitFor(async () => {
  try {
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return pages.find((page) => page.url.startsWith("https://earth.one-life/"));
  } catch {
    return null;
  }
}, "WebView2 CDP");
const socket = new WebSocket(targets.webSocketDebuggerUrl);
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
  } else if (message.method === "Page.javascriptDialogOpening") {
    void call("Page.handleJavaScriptDialog", { accept: true });
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
async function click(text, exact = true) {
  const point = await evaluate(`(() => { const button = [...document.querySelectorAll("button")].find((node) => ${exact ? "node.textContent ===" : "node.textContent.includes"}(${JSON.stringify(text)}) && node.getBoundingClientRect().width > 0); if (!button) return null; button.scrollIntoView({ block: "center" }); const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  if (!point) throw new Error(`Button not found: ${text}`);
  await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}
async function waitText(text) {
  await waitFor(async () => await evaluate(`document.body?.textContent.includes(${JSON.stringify(text)}) ?? false`), text);
}
async function importFile(path) {
  const document = await call("DOM.getDocument", { depth: -1 });
  const input = await call("DOM.querySelector", { nodeId: document.root.nodeId, selector: ".save-import-input" });
  await call("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [path] });
}
const report = { passed: false, checks: {}, errors };
await mkdir(out, { recursive: true });
if (process.env.EARTH_WINDOWS_RESUME === "1") {
  await call("Runtime.enable");
  report.resumeState = await evaluate(`({ text: document.body?.textContent?.slice(0, 800), saved: Boolean(localStorage.getItem("earth:life:v10")), url: location.href })`);
  console.log(JSON.stringify(report.resumeState));
  if (await evaluate(`[...document.querySelectorAll("button")].some((node) => node.textContent === "Continue")`)) await click("Continue");
  await waitFor(async () => await evaluate(`document.querySelector(".game-hero h1")?.textContent`) === "Windows Import", "save after process restart");
  report.checks.processRestart = true;
  report.passed = true;
  await writeFile(join(out, "report-restart.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  socket.close();
  process.exit(0);
}
for (const file of await readdir(downloads).catch(() => [])) if (file.endsWith(".json")) await rm(join(downloads, file), { force: true });
try {
  await Promise.all([call("Page.enable"), call("Runtime.enable"), call("Network.enable")]);
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.clear();` });
  await call("Page.navigate", { url: "https://earth.one-life/index.html?seed=windows-e2e" });
  await waitText("Прежде чем начать");
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  await evaluate(`localStorage.setItem("earth:language", "en")`);
  await call("Page.reload", { ignoreCache: true });
  await waitText("Before you begin");
  await click("Start a new life");
  await waitText("Live this year");
  await click("Live this year");
  await waitFor(async () => await evaluate(`document.querySelectorAll(".event .choice button").length`) === 4, "four choices");
  report.checks.offlineChoices = 4;
  report.checks.seed = JSON.parse(await evaluate(`localStorage.getItem("earth:life:v10")`)).seed;
  await evaluate(`(() => { window.__audioPlayCalls = 0; window.__audioVolume = null; const original = HTMLMediaElement.prototype.play; window.__audioOriginalPlay = original; HTMLMediaElement.prototype.play = function() { window.__audioPlayCalls++; window.__audioVolume = this.volume; return original.call(this); }; })()`);
  await click("Sound: off");
  await evaluate(`(() => { const input=document.querySelector(".audio-volume input"); input.value="35"; input.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await click("Preview sound");
  const audio = await evaluate(`({ settings: JSON.parse(localStorage.getItem("earth:audio:v1")), calls: window.__audioPlayCalls, volume: window.__audioVolume })`);
  if (audio.settings?.enabled !== true || audio.settings?.volume !== 0.35 || audio.calls < 1 || Math.abs(audio.volume - 0.1225) > 0.0001) throw new Error(`Windows audio: ${JSON.stringify(audio)}`);
  report.checks.audio = true;
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await click("Export save");
  const exportedName = await waitFor(async () => {
    const files = await readdir(downloads).catch(() => []);
    return files.find((file) => file.startsWith("earth-") && file.endsWith(".json")) ?? null;
  }, "save export download");
  report.checks.export = exportedName;
  const exported = JSON.parse(await readFile(join(downloads, exportedName), "utf8"));
  exported.birth.name = "Windows Import";
  const importPath = resolve(".tools/windows-import.json");
  await writeFile(importPath, JSON.stringify(exported));
  await importFile(importPath);
  await waitFor(async () => await evaluate(`document.querySelector(".game-hero h1")?.textContent`) === "Windows Import", "imported life");
  report.checks.import = true;
  await call("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`document.querySelector(".game-hero h1")?.textContent`) === "Windows Import", "save after restart");
  report.checks.restart = true;
  const restoredAudio = await evaluate(`({ settings: JSON.parse(localStorage.getItem("earth:audio:v1")), volume: document.querySelector(".audio-volume input")?.value })`);
  if (restoredAudio.settings?.enabled !== true || restoredAudio.settings?.volume !== 0.35 || restoredAudio.volume !== "35") throw new Error(`Windows audio restart: ${JSON.stringify(restoredAudio)}`);
  report.checks.audioRestart = true;
  await click("Sound: on");
  if (await evaluate(`JSON.parse(localStorage.getItem("earth:audio:v1")).enabled !== false`)) throw new Error("Windows audio did not turn off");
  await evaluate(`(() => { HTMLMediaElement.prototype.play = window.__audioOriginalPlay; delete window.__audioOriginalPlay; })()`);
  await evaluate(`(() => { window.__earthTestAlert = null; window.alert = (message) => { window.__earthTestAlert = message; }; })()`);
  const newer = structuredClone(exported);
  newer.version = 11;
  newer.birth.name = "Must Not Replace";
  const newerPath = resolve(".tools/windows-newer.json");
  await writeFile(newerPath, JSON.stringify(newer));
  await importFile(newerPath);
  await waitFor(async () => await evaluate(`typeof window.__earthTestAlert === "string" && window.__earthTestAlert.includes("newer version")`), "newer save warning");
  report.checks.newerRejected = await evaluate(`document.querySelector(".game-hero h1")?.textContent === "Windows Import" && JSON.parse(localStorage.getItem("earth:life:v10")).birth.name === "Windows Import"`);
  if (!report.checks.newerRejected) throw new Error("Newer save replaced the current life");
  const corruption = await call("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("earth:life:v10", "{truncated");` });
  await call("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`document.querySelector(".game-hero h1")?.textContent === "Windows Import" || [...document.querySelectorAll("button")].some((node) => node.textContent === "Continue")`), "backup recovery screen");
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: corruption.identifier });
  if (await evaluate(`[...document.querySelectorAll("button")].some((node) => node.textContent === "Continue")`)) await click("Continue");
  await waitFor(async () => await evaluate(`document.querySelector(".game-hero h1")?.textContent === "Windows Import"`), "backup life after reload");
  await waitText("The primary save was damaged. The previous backup copy has been restored.");
  report.checks.backupRecovery = true;
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, "windows-offline-import.png"), Buffer.from(String(shot.data), "base64"));
  if (errors.length > 0) throw new Error(errors.join("\n"));
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  report.failureState = await evaluate(`({ url: location.href, text: document.body?.textContent?.slice(0, 2000), language: localStorage.getItem("earth:language"), saved: Boolean(localStorage.getItem("earth:life:v10")) })`).catch((diagnosticError) => String(diagnosticError));
  throw error;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  socket.close();
}
