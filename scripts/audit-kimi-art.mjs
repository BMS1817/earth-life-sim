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
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "http://127.0.0.1:4175/";
const outIndex = process.argv.indexOf("--out");
const out = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : "shots/art-exhaustive");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "earth-art-exhaustive-"));
const port = 9700 + Math.floor(Math.random() * 200);
const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let cdp;
const startedAt = Date.now();

const setup = `(async () => {
  const { Scene } = await import("/src/ui/scene.ts");
  const { appearanceForSeed } = await import("/src/ui/appearance.ts");
  const scene = new Scene();
  const manifest = await scene.ensureManifest();
  const climates = ["north", "temperate", "tropics"];
  const careers = Object.keys(manifest.careers);
  const ages = [1, 4, 10, 15, 24, 35, 50, 65, 85];
  const names = ["audit-north", "audit-temperate", "audit-tropics"];
  for (const assets of manifest.ages) {
    const tasks = [scene.ensureImage(assets.heads.replace(/\\.png$/, "")), scene.ensureImage(assets.bodies.replace(/\\.png$/, ""))];
    if (assets.front) tasks.push(scene.ensureImage(assets.front.replace(/\\.png$/, "")));
    await Promise.all(tasks);
  }
  await Promise.all(manifest.ages.filter((assets) => Number(assets.key.slice(0, 2)) >= 4).flatMap((assets) => careers.map((career) => scene.ensureImage((assets.careers?.[career] ?? "career_" + career + "_" + assets.key + ".png").replace(/\.png$/, "")))));
  const seeds = new Map();
  for (const sex of ["F", "M"]) {
    for (let index = 0; index < 100000 && seeds.size < 216; index++) {
      const seed = "exhaustive-" + index;
      const appearance = appearanceForSeed(seed, sex);
      const key = [sex, appearance.face, appearance.body, appearance.skin].join(":");
      if (!seeds.has(key)) seeds.set(key, seed);
    }
  }
  if (seeds.size !== 216) throw new Error("Не удалось покрыть 216 сочетаний внешности: " + seeds.size);

  function analyze(data, stride, offsetX, width, height) {
    const mask = new Uint8Array(width * height);
    let count = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    const edges = { left: 0, right: 0, top: 0, bottom: 0 };
    let hash = 2166136261;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * stride + offsetX + x) * 4;
        if (data[index + 3] === 0) continue;
        mask[y * width + x] = 1;
        count++;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        if (x === 0) edges.left++;
        if (x === width - 1) edges.right++;
        if (y === 0) edges.top++;
        if (y === height - 1) edges.bottom++;
        hash = Math.imul(hash ^ data[index], 16777619);
        hash = Math.imul(hash ^ data[index + 1], 16777619);
        hash = Math.imul(hash ^ data[index + 2], 16777619);
      }
    }
    const seen = new Uint8Array(mask.length);
    const stack = new Int32Array(mask.length);
    const components = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || seen[start]) continue;
      let size = 0;
      let length = 1;
      stack[0] = start;
      seen[start] = 1;
      while (length > 0) {
        const point = stack[--length];
        size++;
        const x = point % width;
        if (x > 0 && mask[point - 1] && !seen[point - 1]) { seen[point - 1] = 1; stack[length++] = point - 1; }
        if (x + 1 < width && mask[point + 1] && !seen[point + 1]) { seen[point + 1] = 1; stack[length++] = point + 1; }
        if (point >= width && mask[point - width] && !seen[point - width]) { seen[point - width] = 1; stack[length++] = point - width; }
        if (point + width < mask.length && mask[point + width] && !seen[point + width]) { seen[point + width] = 1; stack[length++] = point + width; }
      }
      components.push(size);
    }
    components.sort((a, b) => b - a);
    return { count, bbox: count ? [left, top, right, bottom] : null, edges, components, hash: hash >>> 0 };
  }

  function issueList(report, key, frame, metrics) {
    if (!metrics.count) report.empty.push({ key, frame });
    if (metrics.edges.left || metrics.edges.right || metrics.edges.top || metrics.edges.bottom) report.clipped.push({ key, frame, bbox: metrics.bbox, edges: metrics.edges });
    const significant = metrics.components.filter((size) => size >= Math.max(4, metrics.count * 0.12));
    if (significant.length > 1) report.disconnected.push({ key, frame, components: metrics.components.slice(0, 8), pixels: metrics.count });
  }

  function configSeed(sex, face, body, skin) {
    return seeds.get([sex, face, body, skin].join(":"));
  }

  function sheetFor(config, reaction = "idle") {
    const seed = configSeed(config.sex, config.face, config.body, config.skin);
    return scene.personSheet(seed, config.sex, config.age, config.climate, reaction, config.career ?? null);
  }

  function auditSheet(report, config, signatureGroups, baseBottoms) {
    const sheet = sheetFor(config);
    const data = sheet.getContext("2d").getImageData(0, 0, sheet.width, sheet.height).data;
    const key = [config.age, config.sex, config.face, config.body, config.skin, config.climate, config.career ?? "base"].join(":");
    const geometryKey = [config.age, config.sex, config.face, config.body, config.climate].join(":");
    const hashes = [];
    let expectedBottom = null;
    for (let frame = 0; frame < 8; frame++) {
      const metrics = analyze(data, sheet.width, frame * 64, 64, 96);
      issueList(report, key, frame, metrics);
      if (metrics.bbox) {
        if (expectedBottom === null) expectedBottom = metrics.bbox[3];
        else if (metrics.bbox[3] !== expectedBottom) report.pivot.push({ key, frame, expected: expectedBottom, bottom: metrics.bbox[3] });
        if (config.career === null && frame === 0) baseBottoms.set(geometryKey, metrics.bbox[3]);
        if (config.career !== null && baseBottoms.get(geometryKey) !== metrics.bbox[3]) report.careerPivot.push({ key, frame, expected: baseBottoms.get(geometryKey), bottom: metrics.bbox[3] });
      }
      hashes.push(metrics.hash);
    }
    const groupKey = [config.age, config.sex, config.face, config.body, config.climate, config.career ?? "base"].join(":");
    if (!signatureGroups.has(groupKey)) signatureGroups.set(groupKey, []);
    signatureGroups.get(groupKey).push({ skin: config.skin, hashes });
    report.frames += 8;
    report.combinations++;
    scene.peopleCache.clear();
  }

  function finishSkinGroups(report, signatureGroups) {
    for (const [key, variants] of signatureGroups) {
      variants.sort((a, b) => a.skin - b.skin);
      if (variants.length !== 6) report.incompleteSkinGroups.push({ key, count: variants.length });
      for (let frame = 0; frame < 8; frame++) {
        if (new Set(variants.map((variant) => variant.hashes[frame])).size !== 6) report.identicalSkinVariants.push({ key, frame });
      }
    }
  }

  function contact(entries, columns = 6, scale = 3, frame = 0) {
    const cellWidth = 80;
    const cellHeight = 116;
    const rows = Math.ceil(entries.length / columns);
    const native = document.createElement("canvas");
    native.width = columns * cellWidth;
    native.height = rows * cellHeight;
    const ctx = native.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f3ecdf";
    ctx.fillRect(0, 0, native.width, native.height);
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    entries.forEach((entry, index) => {
      const x = (index % columns) * cellWidth;
      const y = Math.floor(index / columns) * cellHeight;
      ctx.fillStyle = "#343a45";
      ctx.fillText(entry.label, x + 2, y + 2, cellWidth - 4);
      const sheet = sheetFor(entry.config, entry.reaction ?? "idle");
      ctx.drawImage(sheet, (entry.frame ?? frame) * 64, 0, 64, 96, x + 8, y + 16, 64, 96);
    });
    scene.peopleCache.clear();
    const scaled = document.createElement("canvas");
    scaled.width = native.width * scale;
    scaled.height = native.height * scale;
    const output = scaled.getContext("2d");
    output.imageSmoothingEnabled = false;
    output.drawImage(native, 0, 0, scaled.width, scaled.height);
    return scaled.toDataURL("image/png");
  }

  function moduleContact(kind) {
    const entries = [];
    for (let ageIndex = 0; ageIndex < manifest.ages.length; ageIndex++) {
      const assets = manifest.ages[ageIndex];
      if (kind === "heads") {
        const image = scene.images.get(assets.heads.replace(/\\.png$/, ""));
        for (let index = 0; index < 12; index++) entries.push({ label: ages[ageIndex] + " " + (index < 6 ? "F" : "M") + (index % 6), image, sx: (index % 6) * 64, sy: Math.floor(index / 6) * 64, sw: 64, sh: 64 });
      } else {
        const image = scene.images.get(assets.bodies.replace(/\\.png$/, ""));
        for (let index = 0; index < 18; index++) entries.push({ label: ages[ageIndex] + " " + (index < 9 ? "F" : "M") + (index % 3) + " " + climates[Math.floor(index / 6)], image, sx: (index % 6) * 64, sy: Math.floor(index / 6) * 96, sw: 64, sh: 96 });
      }
    }
    if (kind === "careers") {
      const assets = manifest.ages[5];
      for (const career of careers) {
        const name = (assets.careers?.[career] ?? "career_" + career + "_" + assets.key + ".png").replace(/\.png$/, "");
        const image = scene.images.get(name);
        const count = manifest.socket && assets.careers ? 18 : 6;
        for (let index = 0; index < count; index++) entries.push({ label: career + " " + index, image, sx: (index % 6) * 64, sy: Math.floor(index / 6) * (count === 18 ? 96 : 48), sw: 64, sh: count === 18 ? 96 : 48 });
      }
    }
    const cellWidth = 80;
    const cellHeight = 116;
    const columns = 12;
    const scale = 2;
    const native = document.createElement("canvas");
    native.width = columns * cellWidth;
    native.height = Math.ceil(entries.length / columns) * cellHeight;
    const ctx = native.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f3ecdf";
    ctx.fillRect(0, 0, native.width, native.height);
    ctx.font = "9px monospace";
    entries.forEach((entry, index) => {
      const x = (index % columns) * cellWidth;
      const y = Math.floor(index / columns) * cellHeight;
      ctx.fillStyle = "#343a45";
      ctx.fillText(entry.label, x + 2, y + 2, cellWidth - 4);
      ctx.drawImage(entry.image, entry.sx, entry.sy, entry.sw, entry.sh, x + 8, y + 16, entry.sw, entry.sh);
    });
    const scaled = document.createElement("canvas");
    scaled.width = native.width * scale;
    scaled.height = native.height * scale;
    const output = scaled.getContext("2d");
    output.imageSmoothingEnabled = false;
    output.drawImage(native, 0, 0, scaled.width, scaled.height);
    return scaled.toDataURL("image/png");
  }

  function auditModules() {
    const report = { heads: 0, bodies: 0, careers: 0, empty: [], clipped: [], separateComponents: [] };
    const scratch = document.createElement("canvas");
    const ctx = scratch.getContext("2d");
    function one(image, sx, sy, width, height, key) {
      scratch.width = width;
      scratch.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, sx, sy, width, height, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;
      const metrics = analyze(data, width, 0, width, height);
      if (!metrics.count) report.empty.push({ key });
      const connectorBottom = manifest.socket && key.includes(":head:") && metrics.bbox?.[3] === 63;
      if (metrics.edges.left || metrics.edges.right || metrics.edges.top || (metrics.edges.bottom && !connectorBottom)) report.clipped.push({ key, bbox: metrics.bbox, edges: metrics.edges });
      const significant = metrics.components.filter((size) => size >= Math.max(4, metrics.count * 0.12));
      if (significant.length > 1) report.separateComponents.push({ key, components: metrics.components.slice(0, 8), pixels: metrics.count });
    }
    for (let ageIndex = 0; ageIndex < manifest.ages.length; ageIndex++) {
      const assets = manifest.ages[ageIndex];
      const heads = scene.images.get(assets.heads.replace(/\\.png$/, ""));
      const bodies = scene.images.get(assets.bodies.replace(/\\.png$/, ""));
      for (let index = 0; index < 12; index++) {
        one(heads, (index % 6) * 64, Math.floor(index / 6) * 64, 64, 64, assets.key + ":head:" + index);
        report.heads++;
      }
      for (let index = 0; index < 18; index++) {
        one(bodies, (index % 6) * 64, Math.floor(index / 6) * 96, 64, 96, assets.key + ":body:" + index);
        report.bodies++;
      }
    }
    for (const assets of manifest.ages.filter((item) => Number(item.key.slice(0, 2)) >= 4)) for (const career of careers) {
      const name = (assets.careers?.[career] ?? "career_" + career + "_" + assets.key + ".png").replace(/\.png$/, "");
      const image = scene.images.get(name);
      const count = manifest.socket && assets.careers ? 18 : 6;
      for (let index = 0; index < count; index++) {
        one(image, (index % 6) * 64, Math.floor(index / 6) * (count === 18 ? 96 : 48), 64, count === 18 ? 96 : 48, assets.key + ":" + career + ":body:" + index);
        report.careers++;
      }
    }
    return report;
  }

  window.__artAudit = {
    manifest, climates, careers, ages, names,
    modules: auditModules,
    moduleContact,
    auditAge(ageIndex) {
      const report = { combinations: 0, frames: 0, empty: [], clipped: [], pivot: [], careerPivot: [], disconnected: [], incompleteSkinGroups: [], identicalSkinVariants: [] };
      const signatureGroups = new Map();
      const baseBottoms = new Map();
      const age = ages[ageIndex];
      const careerOptions = age >= 18 ? [null, ...careers] : [null];
      for (const career of careerOptions) for (const climate of climates) for (const sex of ["F", "M"]) for (let face = 0; face < 6; face++) for (let body = 0; body < 3; body++) for (let skin = 0; skin < 6; skin++) {
        auditSheet(report, { age, sex, face, body, skin, climate, career }, signatureGroups, baseBottoms);
      }
      finishSkinGroups(report, signatureGroups);
      return report;
    },
    contact,
    baseConfig(overrides = {}) {
      return { age: 35, sex: "F", face: 0, body: 1, skin: 1, climate: "temperate", career: null, ...overrides };
    }
  };
  return { heads: 108, bodies: 162, garments: careers.length * 6 * 5, seeds: seeds.size, ages: manifest.ages.length, careers: careers.length };
})()`;

async function saveContact(name, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) throw new Error(`Нет изображения ${name}`);
  await writeFile(join(out, `${name}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
}

try {
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
  }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.call("Page.navigate", { url: base });
  await waitFor(async () => {
    try { return await evaluate(cdp, `document.readyState === "complete"`); } catch { return false; }
  }, "страница");
  const setupResult = await evaluate(cdp, setup);
  console.log("Подготовка:", JSON.stringify(setupResult));
  const report = { expected: { base: 5832, professions: 22680, combinations: 28512, frames: 228096 }, setup: setupResult, modules: await evaluate(cdp, `window.__artAudit.modules()`), ageReports: [] };
  for (const kind of ["heads", "bodies", "careers"]) await saveContact(`modules-${kind}`, await evaluate(cdp, `window.__artAudit.moduleContact(${JSON.stringify(kind)})`));
  for (let ageIndex = 0; ageIndex < 9; ageIndex++) {
    const ageReport = await evaluate(cdp, `window.__artAudit.auditAge(${ageIndex})`);
    report.ageReports.push({ ageIndex, ...ageReport });
    const total = report.ageReports.reduce((sum, item) => sum + item.combinations, 0);
    console.log(`Возраст ${ageIndex + 1}/9: ${ageReport.combinations} комбинаций; всего ${total}; дефекты ${JSON.stringify({ empty: ageReport.empty.length, clipped: ageReport.clipped.length, pivot: ageReport.pivot.length, disconnected: ageReport.disconnected.length, identicalSkin: ageReport.identicalSkinVariants.length })}`);
    await writeFile(join(out, "report.partial.json"), JSON.stringify(report, null, 2));
  }

  const contacts = [
    ["ages", 9, 3, `Array.from({length:9},(_,ageIndex)=>{const a=window.__artAudit;const config=a.baseConfig({age:a.ages[ageIndex]});return{label:a.ages[ageIndex]+" лет",config}})`],
    ["faces", 12, 4, `Array.from({length:12},(_,index)=>{const a=window.__artAudit;return{label:(index<6?"F ":"M ")+(index%6),config:a.baseConfig({sex:index<6?"F":"M",face:index%6})}})`],
    ["bodies", 6, 4, `Array.from({length:6},(_,index)=>{const a=window.__artAudit;return{label:(index<3?"F ":"M ")+(index%3),config:a.baseConfig({sex:index<3?"F":"M",body:index%3})}})`],
    ["skins", 6, 4, `Array.from({length:6},(_,skin)=>{const a=window.__artAudit;return{label:"Тон "+skin,config:a.baseConfig({skin})}})`],
    ["climates", 3, 4, `Array.from({length:3},(_,index)=>{const a=window.__artAudit;return{label:a.climates[index],config:a.baseConfig({climate:a.climates[index]})}})`],
    ["careers", 7, 4, `Array.from({length:7},(_,index)=>{const a=window.__artAudit;return{label:a.careers[index],config:a.baseConfig({career:a.careers[index]})}})`],
    ["age-sex", 18, 3, `Array.from({length:18},(_,index)=>{const a=window.__artAudit;return{label:a.ages[Math.floor(index/2)]+" "+(index%2?"M":"F"),config:a.baseConfig({age:a.ages[Math.floor(index/2)],sex:index%2?"M":"F"})}})`],
    ["face-body", 36, 2, `Array.from({length:36},(_,index)=>{const a=window.__artAudit;const sex=index<18?"F":"M";const local=index%18;return{label:sex+" лицо "+Math.floor(local/3)+" тело "+(local%3),config:a.baseConfig({sex,face:Math.floor(local/3),body:local%3})}})`],
    ["climate-career", 21, 3, `Array.from({length:21},(_,index)=>{const a=window.__artAudit;return{label:a.climates[Math.floor(index/7)]+" "+a.careers[index%7],config:a.baseConfig({climate:a.climates[Math.floor(index/7)],career:a.careers[index%7]})}})`],
    ["adult-age-career", 35, 2, `Array.from({length:35},(_,index)=>{const a=window.__artAudit;const age=a.ages[4+Math.floor(index/7)];return{label:age+" "+a.careers[index%7],config:a.baseConfig({age,career:a.careers[index%7]})}})`],
    ["skin-face", 36, 2, `Array.from({length:36},(_,index)=>{const a=window.__artAudit;return{label:"Лицо "+Math.floor(index/6)+" тон "+(index%6),config:a.baseConfig({face:Math.floor(index/6),skin:index%6})}})`]
  ];
  for (const [name, count, scale, expression] of contacts) {
    await saveContact(name, await evaluate(cdp, `window.__artAudit.contact(${expression}, ${count}, ${scale})`));
  }
  for (let ageIndex = 0; ageIndex < 9; ageIndex++) {
    const entries = `Array.from({length:8},(_,frame)=>({label:"Кадр "+(frame+1),frame,config:window.__artAudit.baseConfig({age:window.__artAudit.ages[${ageIndex}]})}))`;
    await saveContact(`animation-age-${ageIndex}`, await evaluate(cdp, `window.__artAudit.contact(${entries},8,3)`));
  }
  const aggregate = { combinations: 0, frames: 0, empty: 0, clipped: 0, pivot: 0, careerPivot: 0, disconnected: 0, incompleteSkinGroups: 0, identicalSkinVariants: 0 };
  for (const age of report.ageReports) for (const key of Object.keys(aggregate)) aggregate[key] += age[key].length !== undefined && key !== "combinations" && key !== "frames" ? age[key].length : age[key];
  report.aggregate = aggregate;
  report.elapsedMs = Date.now() - startedAt;
  report.passed = aggregate.combinations === 28512 && aggregate.frames === 228096 && Object.entries(aggregate).every(([key, value]) => key === "combinations" || key === "frames" || value === 0) && report.modules.empty.length === 0 && report.modules.clipped.length === 0;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log("Итог:", JSON.stringify({ aggregate, modules: report.modules, passed: report.passed, elapsedMs: report.elapsedMs }));
  if (!report.passed) process.exitCode = 1;
} finally {
  cdp?.socket.close();
  if (browser.exitCode === null) await new Promise((resolveExit) => { browser.once("exit", resolveExit); browser.kill(); });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
