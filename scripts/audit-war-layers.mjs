import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 60));
  }
  throw new Error(`Таймаут: ${description}`);
}
function difference(a, b, region = null) {
  const [left, top, width, height] = region ?? [0, 0, 256, 192];
  let changed = 0;
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const index = (y * 256 + x) * 4;
      if (a.pixels[index] !== b.pixels[index] || a.pixels[index + 1] !== b.pixels[index + 1] || a.pixels[index + 2] !== b.pixels[index + 2] || a.pixels[index + 3] !== b.pixels[index + 3]) changed++;
    }
  }
  return changed;
}

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
if (!chrome) throw new Error("Chrome не найден");
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "http://127.0.0.1:4175/";
const outIndex = process.argv.indexOf("--out");
const out = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : "shots/war-layers-audit");
const profile = await mkdtemp(join(tmpdir(), "earth-war-layers-"));
const port = 9700 + Math.floor(Math.random() * 200);
const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let cdp;
const captures = new Map();
await mkdir(out, { recursive: true });
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
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.call("Page.navigate", { url: auditUrl() });
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("#soften-start"))`), "старт");
  await evaluate(cdp, `[...document.querySelectorAll("button")].find((node) => node.textContent.includes("Начать новую жизнь"))?.click()`);
  await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("canvas.scene"))`), "сцена");
  await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
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
    if (params.has("auditNpcSameAge")) {
      const person = state.people.find((item) => item.alive);
      if (person) person.birthYear = state.birth.year;
    }
    state.lastFamilyPersonId = params.has("auditNpc") ? state.people.find((person) => person.alive)?.id ?? null : null;
    state.pendingFamilyEventId = null;
    state.lastOutcome = null;
    state.lastOutcomeKind = null;
    localStorage.setItem(key, JSON.stringify(state));
  })()` });
  async function capture(name, overrides = {}) {
    await cdp.call("Page.navigate", { url: auditUrl(overrides) });
    await waitFor(async () => evaluate(cdp, `Boolean(document.querySelector("canvas.scene"))`), name);
    await waitFor(async () => evaluate(cdp, `(() => {
      const canvas = document.querySelector("canvas.scene");
      if (!canvas) return false;
      const data = canvas.getContext("2d").getImageData(0, 0, 256, 192).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4) colors.add([...data.slice(i, i + 4)].join(","));
      return colors.size > 10;
    })()`), `кадр ${name}`);
    await waitFor(async () => {
      const frame = await evaluate(cdp, `document.querySelector("canvas.scene").toDataURL()`);
      const stable = await evaluate(cdp, `(() => { const same = window.__auditFrame === ${JSON.stringify(frame)}; window.__auditStable = same ? (window.__auditStable ?? 0) + 1 : 0; window.__auditFrame = ${JSON.stringify(frame)}; return window.__auditStable >= 8; })()`);
      return stable;
    }, `стабильный кадр ${name}`);
    const result = await evaluate(cdp, `(() => {
      const canvas = document.querySelector("canvas.scene");
      const enlarged = document.createElement("canvas");
      enlarged.width = 1024;
      enlarged.height = 768;
      const ctx = enlarged.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, 1024, 768);
      return { raw: canvas.toDataURL("image/png"), enlarged: enlarged.toDataURL("image/png"), pixels: [...canvas.getContext("2d").getImageData(0, 0, 256, 192).data] };
    })()`);
    await writeFile(join(out, `${name}.png`), Buffer.from(result.raw.split(",")[1], "base64"));
    await writeFile(join(out, `${name}@4x.png`), Buffer.from(result.enlarged.split(",")[1], "base64"));
    captures.set(name, { pixels: result.pixels });
  }
  await capture("base");
  const careers = ["medicine", "education", "engineering", "industry", "agriculture", "services", "pilot"];
  for (const career of careers) await capture(`career-${career}`, { auditCareer: career });
  await capture("war-base", { auditWar: "war-start" });
  await capture("war-medicine", { auditWar: "war-start", auditCareer: "medicine" });
  await capture("war-pilot", { auditWar: "war-start", auditCareer: "pilot" });
  await capture("war-npc", { auditWar: "war-start", auditCareer: "pilot", auditNpc: 1 });
  await capture("war-npc-visible", { auditWar: "war-start", auditCareer: "pilot", auditNpc: 1, auditNpcSameAge: 1 });
  await capture("civilian-npc-visible", { auditWar: "war-start", auditSoften: 1, auditNpc: 1, auditNpcSameAge: 1 });
  await capture("civilian", { auditWar: "war-start", auditSoften: 1 });
  await capture("displaced-base", { auditDisplaced: 1 });
  await capture("displaced-pilot", { auditDisplaced: 1, auditCareer: "pilot" });
  const careerChecks = careers.map((career) => ({
    career,
    headChangedPixels: difference(captures.get("base"), captures.get(`career-${career}`), [96, 92, 64, 28]),
    bodyChangedPixels: difference(captures.get("base"), captures.get(`career-${career}`), [96, 132, 64, 56]),
  }));
  const report = {
    careerChecks,
    warMedicineMatchesBase: difference(captures.get("war-base"), captures.get("war-medicine")) === 0,
    warPilotMatchesBase: difference(captures.get("war-base"), captures.get("war-pilot")) === 0,
    displacedPilotMatchesBase: difference(captures.get("displaced-base"), captures.get("displaced-pilot")) === 0,
    soldierHeadTorsoChangedPixels: difference(captures.get("civilian"), captures.get("war-base"), [48, 112, 62, 32]),
    soldierLowerVisiblePixels: difference(captures.get("civilian"), captures.get("war-base"), [48, 144, 62, 43]),
    soldierFullRegionChangedPixels: difference(captures.get("civilian"), captures.get("war-base"), [48, 92, 64, 96]),
    soldierHeadTorsoOpaquePixels: 766,
    npcVehicleOverlapRegion: [150, 64, 96, 64],
    npcVehicleChangedPixels: difference(captures.get("war-base"), captures.get("war-npc-visible"), [150, 64, 96, 64]),
    npcDifferentAgeVisible: difference(captures.get("war-base"), captures.get("war-npc")) > 0,
  };
  report.soldierHeadTorsoVisibilityRatio = report.soldierHeadTorsoChangedPixels / report.soldierHeadTorsoOpaquePixels;
  report.careerTransitionsPassed = careerChecks.every((item) => item.headChangedPixels === 0 && item.bodyChangedPixels > 0) && report.warMedicineMatchesBase && report.warPilotMatchesBase && report.displacedPilotMatchesBase && report.npcDifferentAgeVisible;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  cdp?.socket.close();
  if (browser.exitCode === null) await new Promise((resolveExit) => { browser.once("exit", resolveExit); browser.kill(); });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
