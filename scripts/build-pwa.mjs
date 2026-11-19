import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL(process.argv.includes("--dist") ? "../dist/" : "../public/", import.meta.url));
const excluded = new Set(["sw.js", "sw-assets.json"]);

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

const assets = (await files(root))
  .filter((path) => !excluded.has(relative(root, path).replaceAll(sep, "/")))
  .map((path) => relative(root, path).replaceAll(sep, "/"))
  .sort();
assets.unshift("index.html", "./");
await writeFile(join(root, "sw-assets.json"), JSON.stringify(assets, null, 2) + "\n");
const version = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);
const workerPath = join(root, "sw.js");
const worker = (await readFile(workerPath, "utf-8")).replace(/const CACHE = "[^"]+"/, `const CACHE = "earth-v1.0.0-${version}"`);
await writeFile(workerPath, worker);
console.log(`PWA: ${assets.length} файлов для оффлайн-кэша (earth-v1.0.0-${version})`);
