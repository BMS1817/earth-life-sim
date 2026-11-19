import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasTranslation } from "../src/content/en/catalog.ts";

const excluded = new Set(["src/ui/strings.ts", "src/ui/strings-en.ts"]);
const files = [];
function collect(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) collect(child);
    else if (entry.isFile() && child.endsWith(".ts") && !excluded.has(child)) files.push(child);
  }
}
collect("src");
const inventory = {};
for (const file of files.sort()) {
  const source = readFileSync(file, "utf-8");
  const strings = new Set();
  for (const match of source.matchAll(/"((?:[^"\\]|\\.)*[А-Яа-яЁё](?:[^"\\]|\\.)*)"/g)) {
    const text = match[1];
    if (!text.includes("\n") && !text.includes("\r") && !text.includes("${") && text !== "ла") strings.add(text);
  }
  if (strings.size > 0) inventory[file] = [...strings].sort((a, b) => a.localeCompare(b, "ru"));
}
mkdirSync("shots", { recursive: true });
writeFileSync("shots/i18n-inventory.json", JSON.stringify(inventory, null, 2));
const total = Object.values(inventory).reduce((sum, strings) => sum + strings.length, 0);
const missing = Object.entries(inventory).flatMap(([file, strings]) => strings.filter((text) => !hasTranslation(text)).map((text) => ({ file, text })));
writeFileSync("shots/i18n-missing.json", JSON.stringify(missing, null, 2));
for (const [file, strings] of Object.entries(inventory)) console.log(`${file}: ${strings.length}`);
console.log(`Уникальных строк по файлам: ${total}; без перевода: ${missing.length}`);
if (missing.length > 0) process.exitCode = 1;
