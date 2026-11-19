import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
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
    const id = this.nextId++;
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
    await new Promise((resolveWait) => setTimeout(resolveWait, 60));
  }
  throw new Error(`Таймаут: ${description}`);
}

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
if (!chrome) throw new Error("Chrome не найден");
const profile = await mkdtemp(join(tmpdir(), "earth-visual-matrix-"));
const port = 9700 + Math.floor(Math.random() * 200);
const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let cdp;
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "http://127.0.0.1:4175/?seed=visual-matrix";
const outIndex = process.argv.indexOf("--out");
const out = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : "shots/visual-matrix");
await mkdir(out, { recursive: true });
const report = [];
const special = [];
const auditUrl = (overrides = {}) => {
  const url = new URL(base);
  url.searchParams.set("seed", "visual-matrix");
  url.searchParams.set("auditIso", "FRA");
  url.searchParams.set("auditMoney", "50");
  url.searchParams.set("auditAge", "35");
  for (const [key, value] of Object.entries(overrides)) url.searchParams.set(key, String(value));
  return url.href;
};
try {
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
  }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.call("Page.navigate", { url: auditUrl() });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("#soften-start"))`), "старт");
  await evaluate(cdp, `document.querySelector("#soften-start").click()`);
  await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent.includes("Начать новую жизнь"))?.click()`);
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("canvas.scene"))`), "сцена");
  await cdp.call("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const params = new URLSearchParams(location.search);
      if (!params.has("auditAge")) return;
      const key = "earth:life:v10";
      const state = JSON.parse(localStorage.getItem(key));
      if (!state) return;
      state.birth.country.iso3 = params.get("auditIso");
      state.scales.money = Number(params.get("auditMoney"));
      state.age = Number(params.get("auditAge"));
      state.alive = true;
      state.deathYear = null;
      state.war.pendingEventId = params.get("auditWar") || null;
      state.war.displacedUntil = params.has("auditDisplaced") ? state.birth.year + state.age + 2 : null;
      state.softenHeavy = params.get("auditSoften") === "1";
      state.finance.career = params.get("auditCareer") || null;
      state.lastFamilyPersonId = null;
      state.pendingFamilyEventId = null;
      state.lastOutcome = null;
      state.lastOutcomeKind = null;
      localStorage.setItem(key, JSON.stringify(state));
    })()`,
  });
  for (const [climate, iso3] of [["north", "RUS"], ["temperate", "FRA"], ["tropics", "BRA"]]) {
    for (const [level, money] of [["poor", 0], ["mid", 50], ["rich", 100]]) {
      for (const age of [1, 4, 10, 15, 24, 35, 50, 65, 85]) {
        const url = auditUrl({ auditIso: iso3, auditMoney: money, auditAge: age });
        await cdp.call("Page.navigate", { url });
        await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("canvas.scene"))`), `${climate}/${level}/${age}`);
        await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent === "Пауза")?.click()`);
        await waitFor(async () => evaluate(cdp, `(() => {
          const canvas = document.querySelector("canvas.scene");
          if (!canvas) return false;
          const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          const colors = new Set();
          for (let i = 0; i < data.length; i += 4) colors.add([...data.slice(i, i + 4)].join(","));
          return colors.size > 10;
        })()`), `кадр ${climate}/${level}/${age}`);
        const rect = await evaluate(cdp, `document.querySelector("canvas.scene").getBoundingClientRect().toJSON()`);
        const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 } });
        const data = Buffer.from(String(shot.data), "base64");
        const name = `${climate}_${level}_${String(age).padStart(2, "0")}`;
        await writeFile(join(out, `${name}.png`), data);
        report.push({ name, climate, level, age, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") });
      }
    }
  }
  async function captureCanvas(name) {
    await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("canvas.scene"))`), name);
    await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent === "Пауза")?.click()`);
    await waitFor(async () => evaluate(cdp, `(() => {
      const canvas = document.querySelector("canvas.scene");
      if (!canvas) return false;
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4) colors.add([...data.slice(i, i + 4)].join(","));
      return colors.size > 10;
    })()`), `кадр ${name}`);
    const rect = await evaluate(cdp, `document.querySelector("canvas.scene").getBoundingClientRect().toJSON()`);
    const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 } });
    const data = Buffer.from(String(shot.data), "base64");
    await writeFile(join(out, `${name}.png`), data);
    return { name, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  }
  for (const career of ["medicine", "education", "engineering", "industry", "agriculture", "services", "pilot"]) {
    await cdp.call("Page.navigate", { url: auditUrl({ auditCareer: career }) });
    special.push({ type: "career", career, ...await captureCanvas(`career-${career}`) });
  }
  for (const [name, overrides] of [
    ["war-military", { auditWar: "war-start" }],
    ["war-civilian", { auditWar: "war-start", auditSoften: 1 }],
    ["evacuation", { auditDisplaced: 1 }],
  ]) {
    await cdp.call("Page.navigate", { url: auditUrl(overrides) });
    special.push({ type: "state", ...await captureCanvas(name) });
  }
  await cdp.call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.call("Page.navigate", { url: auditUrl() });
  await captureCanvas("reduced-motion");
  const reducedFirst = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 1100));
  const reducedSecond = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
  special.push({ type: "reducedMotion", name: "reduced-motion", stable: reducedFirst === reducedSecond });
  await cdp.call("Emulation.setEmulatedMedia", { features: [] });
  await cdp.call("Page.navigate", { url: auditUrl() });
  await captureCanvas("parallax-neutral");
  for (const side of ["left", "right"]) {
    const rect = await evaluate(cdp, `document.querySelector("canvas.scene").getBoundingClientRect().toJSON()`);
    await evaluate(cdp, `(() => { const canvas = document.querySelector("canvas.scene"); const rect = canvas.getBoundingClientRect(); const clientX = ${side === "left" ? "rect.x + 3" : "rect.x + rect.width - 3"}; canvas.dispatchEvent(new PointerEvent("pointermove", { clientX, clientY: rect.y + 10, bubbles: true })); return clientX; })()`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    const seams = await evaluate(cdp, `(async () => {
      const canvas = document.querySelector("canvas.scene");
      const rect = canvas.getBoundingClientRect();
      const px = ${side === "left" ? "rect.x + 3" : "rect.x + rect.width - 3"};
      const pointer = (px - rect.left) / rect.width - 0.5;
      const farX = Math.round(-pointer * 4);
      const nearX = Math.round(-pointer * 10);
      const farSeam = ${side === "left" ? "farX" : "farX + 256"};
      const nearSeam = ${side === "left" ? "nearX" : "nearX + 256"};
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      function difference(x, top, bottom) {
        let total = 0;
        for (let y = top; y < bottom; y++) for (let channel = 0; channel < 4; channel++) total += Math.abs(data[(y * 256 + x - 1) * 4 + channel] - data[(y * 256 + x) * 4 + channel]);
        return total;
      }
      const load = (name) => new Promise((resolveLoad, rejectLoad) => { const image = new Image(); image.onload = () => resolveLoad(image); image.onerror = rejectLoad; image.src = "art/kimi/" + name + ".png"; });
      const [farImage, skyImage] = await Promise.all([load("bg_temperate_far"), load("bg_temperate_sky")]);
      const scratch = document.createElement("canvas");
      scratch.width = 256;
      scratch.height = 96;
      const ctx = scratch.getContext("2d");
      ctx.drawImage(farImage, 0, 0);
      const farData = ctx.getImageData(0, 0, 256, 96).data;
      ctx.clearRect(0, 0, 256, 96);
      ctx.drawImage(skyImage, 0, 0);
      const skyData = ctx.getImageData(0, 0, 256, 96).data;
      const edge = ${side === "left" ? "0" : "255"};
      const over = (front, back) => front[3] === 255 ? front : back;
      const pixel = (source, index) => Array.from(source.slice(index, index + 4));
      let expectedFarDifference = 0;
      for (let y = 0; y < 64; y++) {
        const front = pixel(farData, (y * 256 + edge) * 4);
        const skyLeft = over(pixel(skyData, ((y + 32) * 256 + farSeam - 1) * 4), [126, 192, 232, 255]);
        const skyRight = over(pixel(skyData, ((y + 32) * 256 + farSeam) * 4), [126, 192, 232, 255]);
        const left = over(front, skyLeft);
        const right = over(front, skyRight);
        for (let channel = 0; channel < 4; channel++) expectedFarDifference += Math.abs(left[channel] - right[channel]);
      }
      return { pointer, farSeam, nearSeam, farDifference: difference(farSeam, 32, 96), nearDifference: difference(nearSeam, 176, 192), expectedFarDifference };
    })()`);
    special.push({ type: "parallax", side, ...seams, passed: seams.farDifference === seams.expectedFarDifference && seams.nearDifference === 0, ...await captureCanvas(`parallax-${side}`) });
  }
  const uniqueBaseFrames = new Set(report.map((frame) => frame.sha256)).size;
  const passed = report.length === 81 && uniqueBaseFrames === 81 && special.every((item) => (item.type !== "reducedMotion" || item.stable) && (item.type !== "parallax" || item.passed));
  await writeFile(join(out, "report.json"), JSON.stringify({ count: report.length, uniqueBaseFrames, passed, frames: report, special }, null, 2));
  console.log(`Матрица: ${report.length} базовых + ${special.length} особых проверок; уникальных ${uniqueBaseFrames}; passed=${passed}`);
  if (!passed) process.exitCode = 1;
} finally {
  cdp?.socket.close();
  if (browser.exitCode === null) await new Promise((resolveExit) => { browser.once("exit", resolveExit); browser.kill(); });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
