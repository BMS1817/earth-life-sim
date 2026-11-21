import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, extname } from "node:path";

const root = resolve("dist");
const output = resolve("release/earth-one-life-offline.html");
const excluded = new Set(["index.html", "sw.js", "sw-assets.json", "manifest.webmanifest"]);
const mime = {
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}

const allFiles = await files(root);
const assets = {};
const licenses = [];
let bundleScript = null;
for (const path of allFiles) {
  const key = relative(root, path).replaceAll("\\", "/");
  const content = await readFile(path);
  if (key.startsWith("assets/index-") && key.endsWith(".js")) {
    bundleScript = content.toString("utf8");
    continue;
  }
  if (key.startsWith("licenses/")) licenses.push(`\n\n===== ${key} =====\n${content.toString("utf8")}`);
  if (excluded.has(key)) continue;
  const type = mime[extname(key)] ?? "application/octet-stream";
  assets[key] = `data:${type};base64,${content.toString("base64")}`;
}
if (!bundleScript) throw new Error("Production JS bundle not found");

let html = await readFile(join(root, "index.html"), "utf8");
html = html.replace(/\s*<link rel="manifest"[^>]*>/, "");
html = html.replace(/\s*<link rel="preload"[^>]*as="fetch"[^>]*>/g, "");
html = html.replace(/(href|src)="\.\/([^"]+)"/g, (match, attribute, path) => assets[path] ? `${attribute}="${assets[path]}"` : match);
html = html.replace(/url\(["']?(\.\/)?([^"')]+)["']?\)/g, (match, prefix, path) => assets[path] ? `url("${assets[path]}")` : match);
html = html.replace(/\s*<script type="module"[^>]*><\/script>/, () => {
  const embedded = JSON.stringify(assets).replaceAll("<", "\\u003c");
  const script = bundleScript.replaceAll("</script", "<\\/script");
  const notices = licenses.join("").replaceAll("</script", "<\\/script");
  return `\n<script>window.__EARTH_OFFLINE_ASSETS__=${embedded};</script>\n<script type="text/plain" id="earth-licenses">${notices}</script>\n<script type="module">${script}</script>`;
});
if (html.includes('src="./src/main.ts"') || !html.includes("window.__EARTH_OFFLINE_ASSETS__")) throw new Error("Offline bundle injection failed");

await mkdir(resolve("release"), { recursive: true });
await writeFile(output, html);
console.log(`Offline HTML: ${output}`);
console.log(`Resources: ${Object.keys(assets).length}; size: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB`);
