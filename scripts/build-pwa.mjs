import { readdir, readFile, rm, mkdir, writeFile } from "node:fs/promises";
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

if (process.argv.includes("--dist")) {
  const chunkSizes = { mort: 1, family: 4, conflicts: 16, politics: 16 };
  const kinds = Object.keys(chunkSizes);
  const bundleIndex = {};
  let bundleCount = 0;
  for (const kind of kinds) {
    const chunkSize = chunkSizes[kind];
    const directory = join(root, "data", kind);
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json") && !name.startsWith("_")).sort();
    if (names.length !== 236) throw new Error(`Ожидалось 236 страновых файлов ${kind}, найдено ${names.length}`);
    const chunks = [];
    const countries = {};
    for (let offset = 0; offset < names.length; offset += chunkSize) {
      const chunkIndex = offset / chunkSize;
      const bundle = {};
      for (const name of names.slice(offset, offset + chunkSize)) {
        const iso3 = name.slice(0, -5);
        bundle[iso3] = JSON.parse(await readFile(join(directory, name), "utf-8"));
        countries[iso3] = chunkIndex;
      }
      chunks.push(bundle);
    }
    const output = join(root, "data", "bundles", kind);
    await mkdir(output, { recursive: true });
    for (let index = 0; index < chunks.length; index++) await writeFile(join(output, `${index}.json`), JSON.stringify(chunks[index]));
    await Promise.all(names.map((name) => rm(join(directory, name))));
    bundleIndex[kind] = { chunkSize, countries };
    bundleCount += chunks.length;
  }
  await writeFile(join(root, "data", "bundles", "index.json"), JSON.stringify({ kinds: bundleIndex }));
  console.log(`Страновые данные: 236 стран, ${bundleCount} пакетов`);
}

const assets = (await files(root))
  .filter((path) => !relative(root, path).replaceAll(sep, "/").startsWith("downloads/"))
  .filter((path) => !excluded.has(relative(root, path).replaceAll(sep, "/")))
  .map((path) => relative(root, path).replaceAll(sep, "/"))
  .sort();
assets.unshift("index.html", "./");
if (process.argv.includes("--dist") && assets.length > 1000) throw new Error(`Production ZIP превышает лимит itch.io: ${assets.length} файлов`);
await writeFile(join(root, "sw-assets.json"), JSON.stringify(assets, null, 2) + "\n");
const version = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);
const workerPath = join(root, "sw.js");
const worker = (await readFile(workerPath, "utf-8")).replace(/const CACHE = "[^"]+"/, `const CACHE = "earth-v1.0.0-${version}"`);
await writeFile(workerPath, worker);
console.log(`PWA: ${assets.length} файлов для оффлайн-кэша (earth-v1.0.0-${version})`);
