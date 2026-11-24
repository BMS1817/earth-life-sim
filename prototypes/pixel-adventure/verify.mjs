import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://127.0.0.1:4179/ui-prototype.html";
const out = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : "shots/ui-prototype");
const sizes = [
  ["320", 320, 720, true],
  ["390", 390, 844, true],
  ["768", 768, 1024, true],
  ["1280", 1280, 720, false],
  ["1440", 1440, 1080, false],
  ["1920", 1920, 1080, false],
];
const report = { screenshots: [], layout: {}, pixelRatios: {}, contrast: {}, touchTargets: {}, interactions: {}, consoleErrors: [] };

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

async function navigate(cdp, view, language, width, height, mobile, extra = "") {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await cdp.call("Page.navigate", { url: `${base}?view=${view}${extra}` });
  await waitFor(async () => Boolean(await evaluate(cdp, `document.querySelector("#prototype-app.ready") || document.body?.textContent.includes("Не удалось загрузить")`)), `${view} ready`);
  assert(await evaluate(cdp, `Boolean(document.querySelector("#prototype-app.ready"))`), `Prototype failed to load: ${view}`);
  await evaluate(cdp, `localStorage.setItem("earth:language", ${JSON.stringify(language)})`);
  if (await evaluate(cdp, `document.documentElement.lang !== ${JSON.stringify(language)}`)) {
    await cdp.call("Page.reload", { ignoreCache: true });
    await waitFor(async () => Boolean(await evaluate(cdp, `document.querySelector("#prototype-app.ready")`)), `${view} ${language} ready`);
  }
  await evaluate(cdp, `document.fonts.ready.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
}

async function audit(cdp, name, view, mobile) {
  const layout = await evaluate(cdp, `({
    viewport: [innerWidth, innerHeight],
    document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    horizontal: document.documentElement.scrollWidth > innerWidth,
    mainExternal: ${JSON.stringify(view === "main")} && document.documentElement.scrollHeight > innerHeight,
    outOfBounds: [...document.querySelectorAll("button, canvas, section, main")].filter((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1);
    }).map((node) => ({ className: node.className, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }))
  })`);
  const ratios = await evaluate(cdp, `[...document.querySelectorAll("canvas")].filter((canvas) => {
    const r = canvas.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }).map((canvas) => {
    const r = canvas.getBoundingClientRect();
    return { className: canvas.className, native: [canvas.width, canvas.height], displayed: [r.width, r.height], ratio: [r.width / canvas.width, r.height / canvas.height] };
  })`);
  const contrast = await evaluate(cdp, `(() => {
    const parse = (value) => {
      const match = value.match(/[\\d.]+/g)?.map(Number) ?? [];
      return [match[0] ?? 0, match[1] ?? 0, match[2] ?? 0, match[3] ?? 1];
    };
    const luminance = (rgb) => {
      const values = rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const background = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color[3] > 0.95) return color;
      }
      return [233, 223, 206, 1];
    };
    const failures = [];
    for (const node of document.querySelectorAll("body *")) {
      if (node.matches("script, style, canvas, input") || node.closest("[disabled]")) continue;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      if (![...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim())) continue;
      const fg = luminance(parse(style.color));
      const bg = luminance(background(node));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < 4.49) failures.push({ className: node.className, text: node.textContent.trim().slice(0, 80), ratio });
    }
    return failures;
  })()`);
  const touch = mobile ? await evaluate(cdp, `[...document.querySelectorAll("button")].filter((node) => {
    const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !node.disabled;
  }).map((node) => {
    const r = node.getBoundingClientRect();
    return { className: node.className, text: node.textContent.trim().slice(0, 40), width: r.width, height: r.height, bottomTab: Boolean(node.closest(".prototype-bottom-tabs")) };
  }).filter((item) => item.height < (item.bottomTab ? 47.9 : 43.9))`) : [];
  report.layout[name] = layout;
  report.pixelRatios[name] = ratios;
  report.contrast[name] = contrast;
  report.touchTargets[name] = touch;
  assert(!layout.horizontal, `${name}: horizontal overflow ${JSON.stringify(layout)}`);
  assert(!layout.mainExternal, `${name}: external main overflow ${JSON.stringify(layout)}`);
  assert(layout.outOfBounds.length === 0, `${name}: out of bounds ${JSON.stringify(layout.outOfBounds)}`);
  assert(ratios.every((item) => item.ratio.every((value) => Math.abs(value - Math.round(value)) < 0.01 && Math.round(value) >= 1)), `${name}: fractional canvas ratio ${JSON.stringify(ratios)}`);
  assert(contrast.length === 0, `${name}: contrast ${JSON.stringify(contrast)}`);
  assert(touch.length === 0, `${name}: touch targets ${JSON.stringify(touch)}`);
}

async function capture(cdp, name) {
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(out, `${name}.png`), Buffer.from(String(shot.data), "base64"));
  report.screenshots.push(`${name}.png`);
}

async function click(cdp, selector, index = 0) {
  const clicked = await evaluate(cdp, `(() => { const nodes = document.querySelectorAll(${JSON.stringify(selector)}); const node = nodes[${index}]; if (!node) return false; node.click(); return true; })()`);
  assert(clicked, `Cannot click ${selector}[${index}]`);
}

async function main() {
  await mkdir(out, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), "earth-ui-prototype-"));
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
    await cdp.call("Page.bringToFront");
    await navigate(cdp, "main", "ru", 1280, 720, false);
    for (const language of ["ru", "en"]) {
      for (const view of ["main", "people", "finance", "lifestyle", "politics", "lineage", "memorial"]) {
        for (const [suffix, width, height, mobile] of sizes) {
          const name = `${view}-${language}-${suffix}`;
          await navigate(cdp, view, language, width, height, mobile);
          await audit(cdp, name, view, mobile);
          await capture(cdp, name);
        }
      }
    }

    await navigate(cdp, "main", "ru", 1280, 720, false);
    const beforeChoice = await evaluate(cdp, `document.querySelector(".event-section").textContent`);
    await click(cdp, ".prototype-choice-button");
    await waitFor(async () => (await evaluate(cdp, `document.querySelector(".event-section").textContent`)) !== beforeChoice, "choice changes event");
    report.interactions.choice = true;

    await navigate(cdp, "main", "ru", 390, 844, true);
    for (const [index, tab] of [[1, "hero"], [2, "focus"], [3, "menu"], [0, "event"]]) {
      await click(cdp, ".prototype-bottom-tabs button", index);
      await waitFor(async () => (await evaluate(cdp, `document.body.dataset.mobileTab`)) === tab, `mobile tab ${tab}`);
      if (tab === "hero") assert(await evaluate(cdp, `document.querySelector(".identity-section").getBoundingClientRect().height > 0`), "Hero tab hidden");
      if (tab === "focus") assert(await evaluate(cdp, `document.querySelector(".focus-section").getBoundingClientRect().height > 0`), "Focus tab hidden");
      if (tab === "menu") assert(await evaluate(cdp, `document.querySelector(".mobile-menu-panel").getBoundingClientRect().height > 0`), "Menu tab hidden");
      report.interactions[`tab-${tab}`] = true;
    }

    await navigate(cdp, "people", "ru", 390, 844, true);
    await click(cdp, ".people-master .person-summary");
    await waitFor(async () => Boolean(await evaluate(cdp, `document.querySelector(".people-prototype.show-person-detail")`)), "person detail");
    report.interactions.personSelect = true;
    await click(cdp, ".people-detail-pane .person-detail > button");
    await waitFor(async () => !(await evaluate(cdp, `document.querySelector(".people-prototype.show-person-detail")`)), "person back");
    report.interactions.personBack = true;

    await navigate(cdp, "memorial", "ru", 1280, 720, false);
    await click(cdp, ".favorite-button");
    await waitFor(async () => (await evaluate(cdp, `document.querySelector(".favorite-button").getAttribute("aria-pressed")`)) === "true", "favorite toggle");
    report.interactions.favorite = true;

    await navigate(cdp, "people", "ru", 390, 844, true, "&empty=people");
    assert(await evaluate(cdp, `document.querySelectorAll(".people-master .person-summary").length === 0`), "Empty people list has cards");
    report.interactions.emptyPeople = true;

    await navigate(cdp, "main", "ru", 1280, 720, false);
    const keyboardBefore = await evaluate(cdp, `document.querySelector(".event-section").textContent`);
    await evaluate(cdp, `document.querySelector(".prototype-choice-button").focus()`);
    await cdp.call("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await waitFor(async () => (await evaluate(cdp, `document.querySelector(".event-section").textContent`)) !== keyboardBefore, "keyboard choice");
    report.interactions.keyboardChoice = true;

    await navigate(cdp, "main", "ru", 1280, 720, false);
    await click(cdp, ".menu-button");
    await waitFor(async () => await evaluate(cdp, `Boolean(document.querySelector(".menu-dialog"))`), "desktop menu dialog");
    report.interactions.menuDialog = true;
    await cdp.call("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor(async () => !(await evaluate(cdp, `Boolean(document.querySelector(".menu-dialog"))`)), "menu Escape");
    report.interactions.menuEscape = true;

    await navigate(cdp, "memorial", "ru", 1280, 720, false);
    await click(cdp, ".inheritance-heir");
    await waitFor(async () => (await evaluate(cdp, `document.body.dataset.view`)) === "main", "inheritance returns to main");
    report.interactions.inheritance = true;

    report.consoleErrors = cdp.errors;
    assert(cdp.errors.length === 0, `Console errors: ${cdp.errors.join("\n")}`);
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
    console.log(`UI prototype QA passed: ${report.screenshots.length} screenshots, ${Object.keys(report.interactions).length} interaction checks`);
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
