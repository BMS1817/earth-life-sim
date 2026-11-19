import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf-8")) as { display: string; start_url: string; icons: { src: string; sizes: string }[] };
const assets = JSON.parse(readFileSync("public/sw-assets.json", "utf-8")) as string[];
const worker = readFileSync("public/sw.js", "utf-8");

describe("PWA и оффлайн-кэш", () => {
  it("манифест позволяет установить игру и содержит обе иконки", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./");
    expect(manifest.icons).toHaveLength(2);
    for (const icon of manifest.icons) expect(existsSync(`public/${icon.src}`)).toBe(true);
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
  });

  it("кэш включает данные всех стран, арт и шрифт", () => {
    expect(assets.length).toBeGreaterThan(1000);
    expect(assets).toContain("index.html");
    expect(assets).toContain("data/mort/USA.json");
    expect(assets).toContain("data/politics/X412.json");
    expect(assets).toContain("data/family/_world.json");
    expect(assets).toContain("art/person_senior_idle.png");
    expect(assets).toContain("art/kimi/politics_city.png");
    expect(assets).toContain("licenses/flag-icons.txt");
    expect(assets).toContain("flags/4x3/ru.svg");
    expect(assets).toContain("flags/4x3/us.svg");
    expect(assets.filter((asset) => /^flags\/4x3\/[a-z]{2}\.svg$/.test(asset))).toHaveLength(235);
    expect(assets).toContain("fonts/PressStart2P-Regular.woff2");
    expect(assets.every((asset) => !asset.startsWith("raw/"))).toBe(true);
    expect(new Set(assets).size).toBe(assets.length);
  });

  it("полный пакет не превышает 51 МиБ", () => {
    const bytes = assets.filter((asset) => asset !== "./").reduce((sum, asset) => sum + readFileSync(asset === "index.html" ? "index.html" : `public/${asset}`).byteLength, 0);
    expect(bytes).toBeLessThanOrEqual(51 * 1024 * 1024);
  });

  it("worker обновляет кэш версией, сообщает прогресс и сохраняет offline fallback", () => {
    expect(worker).toContain('const CACHE = "earth-v1.0.0-');
    expect(worker).toContain("earth:cache-ready");
    expect(worker).toContain("earth:cache-progress");
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('caches.match("/index.html")');
    expect(worker).toContain("caches.delete");
  });
});
