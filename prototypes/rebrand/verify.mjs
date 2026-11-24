import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const base = "http://127.0.0.1:4179/ui-prototype.html?qa=1";
const out = resolve("shots/rebrand-preview");
const report = { assets: {}, audio: {}, flow: {}, scenarios: [], consoleErrors: [] };

function chromePath() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("Chrome not found; set CHROME_BIN");
  return executable;
}

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
      if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") this.errors.push(JSON.stringify(message.params));
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
  close() { this.socket.close(); }
}

async function waitFor(check, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timeout: ${description}`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function captureScenario(cdp, name, iso3, money, war, age, memorial = false) {
  const data = await evaluate(cdp, `(async () => {
    const { scene, life } = window.__REBRAND_QA__;
    const state = life.state;
    state.birth.country.iso3 = ${JSON.stringify(iso3)};
    state.scales.money = ${money};
    state.war.pendingEventId = ${JSON.stringify(war)};
    state.softenHeavy = ${JSON.stringify(war === "civilian")};
    state.age = ${age};
    await scene.prepare(state, ${memorial}, false);
    scene.update(state);
    scene.draw(1000);
    return scene.element.toDataURL("image/png").split(",")[1];
  })()`);
  await writeFile(join(out, `${name}.png`), Buffer.from(data, "base64"));
  report.scenarios.push(name);
}

async function playToMemorial(cdp) {
  for (let guard = 0; guard < 2000; guard++) {
    const view = await evaluate(cdp, `document.body.dataset.view`);
    if (view === "memorial") return;
    const clicked = await evaluate(cdp, `(() => {
      const node = document.querySelector(".prototype-choice-button") || document.querySelector(".primary-action");
      if (!node) return false;
      node.click();
      return true;
    })()`);
    assert(clicked, "No action while playing to memorial");
    await new Promise((resolveWait) => setTimeout(resolveWait, 8));
  }
  throw new Error("Life did not reach memorial");
}

async function favoriteMoments(cdp, target) {
  for (let guard = 0; guard < target; guard++) {
    const index = await evaluate(cdp, `[...document.querySelectorAll(".favorite-button")].findIndex((node) => node.getAttribute("aria-pressed") !== "true")`);
    if (index < 0) break;
    await evaluate(cdp, `document.querySelectorAll(".favorite-button")[${index}].click()`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
  const selected = await evaluate(cdp, `document.querySelectorAll(".favorite-button[aria-pressed=true]").length`);
  assert(selected === target, `Expected ${target} favorites, got ${selected}`);
  return selected;
}

async function inherit(cdp, expectedGeneration) {
  await evaluate(cdp, `document.querySelector(".inheritance-heir").click()`);
  await waitFor(async () => (await evaluate(cdp, `document.body.dataset.view`)) === "main", `inherit generation ${expectedGeneration}`);
  const generation = await evaluate(cdp, `window.__REBRAND_QA__.life.state.lineage.generation`);
  assert(generation === expectedGeneration, `Expected generation ${expectedGeneration}, got ${generation}`);
}

async function main() {
  await mkdir(out, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), "earth-rebrand-preview-"));
  const port = 9700 + Math.floor(Math.random() * 200);
  let chrome;
  let cdp;
  try {
    chrome = spawn(chromePath(), [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
    ], { stdio: "ignore" });
    await waitFor(async () => {
      try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
    }, "Chrome");
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    cdp = await Cdp.open(target.webSocketDebuggerUrl);
    await cdp.call("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__audioCalls = [];
      const NativeAudio = window.Audio;
      window.Audio = class extends NativeAudio {
        constructor(src) { super(src); this.__src = src; }
        play() { window.__audioCalls.push(this.__src); return Promise.resolve(); }
      };
    ` });
    await cdp.call("Page.navigate", { url: base });
    await waitFor(async () => Boolean(await evaluate(cdp, `window.__REBRAND_QA__ && document.querySelector("#prototype-app.ready")`)), "Rebrand preview ready");
    const manifest = await evaluate(cdp, `fetch("prototypes/rebrand/assets/manifest.json").then((response) => response.json())`);
    const statuses = await Promise.all(manifest.files.map(async (file) => {
      const response = await fetch(`http://127.0.0.1:4179/prototypes/rebrand/assets/${file}`);
      return [file, response.status];
    }));
    const failed = statuses.filter(([, status]) => status !== 200);
    assert(failed.length === 0, `Missing assets: ${JSON.stringify(failed)}`);
    report.assets = { count: statuses.length, failed };

    const audio = await evaluate(cdp, `(async () => {
      const { RebrandAudio } = await import("/src/ui/rebrand-audio.ts");
      const audio = new RebrandAudio("prototypes/rebrand/assets/audio", "rebrand:");
      const disabledPlayed = audio.play("choice");
      audio.setEnabled(true);
      for (const name of ["choice", "year", "inherit", "button", "menu", "favorite", "error", "death"]) audio.play(name);
      audio.setMusicEnabled(true);
      const musicStarted = audio.ensureMusic();
      return { disabledPlayed, musicStarted, calls: window.__audioCalls };
    })()`);
    assert(audio.disabledPlayed === false, "Disabled audio played");
    assert(audio.musicStarted === true, "Music did not start");
    for (const name of ["choice", "year", "inherit", "button", "menu", "favorite", "error", "death"]) {
      assert(audio.calls.some((src) => src.endsWith(`audio/${name}.ogg`)), `SFX did not play: ${name}`);
    }
    assert(audio.calls.some((src) => src.endsWith("audio/music.ogg")), "Music file not played");
    report.audio = { disabledPlayed: audio.disabledPlayed, musicStarted: audio.musicStarted, signals: 8, calls: audio.calls };

    for (const [iso3, climate] of [["RUS", "north"], ["FRA", "temperate"], ["COL", "tropics"]]) {
      for (const [money, wealth] of [[0, "poor"], [50, "mid"], [100, "rich"]]) {
        await captureScenario(cdp, `${climate}-${wealth}`, iso3, money, null, 35);
        await captureScenario(cdp, `${climate}-${wealth}-damaged`, iso3, money, "civilian", 35);
      }
      await captureScenario(cdp, `${climate}-military`, iso3, 50, "military", 35);
      await captureScenario(cdp, `${climate}-memorial`, iso3, 50, null, 76, true);
    }
    for (const [index, age] of [0, 3, 8, 15, 24, 35, 50, 65, 85].entries()) {
      await captureScenario(cdp, `age-${String(index).padStart(2, "0")}`, "FRA", 50, null, age);
    }
    await playToMemorial(cdp);
    report.flow.favorites = await favoriteMoments(cdp, 32);
    await inherit(cdp, 2);
    await playToMemorial(cdp);
    await inherit(cdp, 3);
    report.flow.generation = 3;
    const finalShot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(join(out, "generation-3-main.png"), Buffer.from(String(finalShot.data), "base64"));
    report.consoleErrors = cdp.errors;
    assert(cdp.errors.length === 0, `Console errors: ${cdp.errors.join("\n")}`);
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
    console.log(`Rebrand QA passed: ${report.assets.count} files, 8 SFX + music, ${report.scenarios.length} scenarios, generation ${report.flow.generation}, ${report.flow.favorites} favorites`);
  } catch (error) {
    report.consoleErrors = cdp?.errors ?? [];
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
    throw error;
  } finally {
    cdp?.close();
    if (chrome && chrome.exitCode === null) {
      const exited = new Promise((resolveExit) => chrome.once("exit", resolveExit));
      chrome.kill();
      await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 3000))]);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await rm(profile, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      }
    }
  }
}

await main();
