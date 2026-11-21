import { spawnSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const stage = resolve(".tools/html5-stage");
const archive = resolve("release/earth-one-life-html.zip");
await rm(stage, { recursive: true, force: true });
await cp(resolve("dist"), stage, {
  recursive: true,
  filter: (source) => !source.includes(`${resolve("dist", "downloads")}`),
});
await rm(archive, { force: true });
const script = [
  "from pathlib import Path",
  "from zipfile import ZIP_DEFLATED, ZipFile",
  "import sys",
  "root, output = map(Path, sys.argv[1:])",
  "with ZipFile(output, 'w', ZIP_DEFLATED) as archive:",
  "    for path in root.rglob('*'):",
  "        if path.is_file():",
  "            archive.write(path, path.relative_to(root).as_posix())",
].join("\n");
const result = spawnSync("python", ["-c", script, stage, archive], { stdio: "inherit" });
if (result.status !== 0) throw new Error(`HTML5 ZIP failed: ${result.status}`);
console.log(`HTML5 ZIP: ${archive}`);
