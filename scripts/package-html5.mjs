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
const result = spawnSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${stage}\\*' -DestinationPath '${archive}' -CompressionLevel Optimal`], { stdio: "inherit" });
if (result.status !== 0) throw new Error(`HTML5 ZIP failed: ${result.status}`);
console.log(`HTML5 ZIP: ${archive}`);
