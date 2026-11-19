import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "content/family-events.ts",
  "content/conflict-events.ts",
  "content/lineage-events.ts",
  "content/local-events.ts",
  "content/crises.ts",
  "content/career-events.ts",
];
for (const name of await readdir(join(root, "src/content/events"))) files.push(`content/events/${name}`);
const mapping = {
  tradition: ["health", "money"],
  change: ["education", "bonds"],
  bonds: ["bonds", "health"],
  self: ["money", "education"],
};

function matchingBrace(text, start) {
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    if (text[index] === "{") depth++;
    if (text[index] === "}") {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function sectorOf(text, position) {
  const before = text.slice(0, position);
  const matches = [...before.matchAll(/sector:\s*["'](tradition|change|bonds|self)["']/g)];
  return matches.at(-1)?.[1] ?? null;
}

let updatedFiles = 0;
let updatedEffects = 0;
for (const file of files) {
  const path = join(root, "src", file);
  const text = await readFile(path, "utf-8");
  const edits = [];
  for (const match of text.matchAll(/\b(effects|successEffects|failEffects):\s*\{/g)) {
    const kind = match[1];
    const sector = sectorOf(text, match.index);
    if (!sector || !mapping[sector]) continue;
    const start = match.index + match[0].length - 1;
    const end = matchingBrace(text, start);
    if (end < 0) continue;
    const body = text.slice(start + 1, end);
    const values = [...body.matchAll(/[a-zA-Z]+:\s*(-?\d+(?:\.\d+)?)/g)].map((item) => Number(item[1])).filter(Number.isFinite);
    if (values.length === 0) continue;
    const magnitude = Math.max(1, Math.round(values.reduce((sum, value) => sum + Math.abs(value), 0) / 2));
    const secondary = Math.max(1, Math.ceil(magnitude / 2));
    const [plus, minus] = mapping[sector];
    const sign = kind === "failEffects" ? -1 : 1;
    edits.push({ start, end: end + 1, text: `{ ${plus}: ${sign * magnitude}, ${minus}: ${-secondary} }` });
    updatedEffects++;
  }
  if (edits.length > 0) {
    const updated = edits.sort((a, b) => b.start - a.start).reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), text);
    await writeFile(path, updated);
    updatedFiles++;
  }
}
console.log(JSON.stringify({ updatedFiles, updatedEffects }));
