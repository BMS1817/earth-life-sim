import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const dotnet = resolve(".tools/dotnet/dotnet.exe");
if (!existsSync(dotnet)) throw new Error("Local .NET SDK is missing. Install it into .tools/dotnet.");
const publish = resolve(".tools/windows-publish");
const stage = resolve("release/Earth-One-Life-Windows");
const archive = resolve("release/earth-one-life-windows.zip");
await rm(publish, { recursive: true, force: true });
await rm(stage, { recursive: true, force: true });
await rm(archive, { force: true });
const result = spawnSync(dotnet, [
  "publish", resolve("windows/Earth.Windows/Earth.Windows.csproj"),
  "--configuration", "Release",
  "--runtime", "win-x64",
  "--self-contained", "true",
  "-p:PublishSingleFile=true",
  "-p:IncludeNativeLibrariesForSelfExtract=true",
  "-p:DebugType=None",
  "--output", publish,
], {
  cwd: resolve("."),
  env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_CLI_DO_NOT_USE_MSBUILD_SERVER: "1", MSBUILDDISABLENODEREUSE: "1", NUGET_PACKAGES: resolve(".tools/nuget") },
  stdio: "inherit",
});
if (result.status !== 0) throw new Error(`dotnet publish failed: ${result.status}`);
await mkdir(stage, { recursive: true });
await cp(publish, stage, { recursive: true });
await cp(resolve("dist"), resolve(stage, "app"), { recursive: true });
const packed = spawnSync("powershell", [
  "-NoProfile", "-Command", `Compress-Archive -Path '${stage}\\*' -DestinationPath '${archive}' -CompressionLevel Optimal`,
], { stdio: "inherit" });
if (packed.status !== 0) throw new Error(`Windows ZIP failed: ${packed.status}`);
console.log(`Windows ZIP: ${archive}`);
