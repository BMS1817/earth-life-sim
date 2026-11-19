import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = JSON.parse(await readFile(join(root, "public/data/index.json"), "utf-8"));
const codes = [...new Set(index.countries.map((country) => country.iso2?.toLowerCase()).filter(Boolean))].sort();
const output = join(root, "public/flags/4x3");
await mkdir(output, { recursive: true });
for (const code of codes) {
  await copyFile(join(root, `node_modules/flag-icons/flags/4x3/${code}.svg`), join(output, `${code}.svg`));
}
console.log(`Флаги: ${codes.length} локальных SVG`);
