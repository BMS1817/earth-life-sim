import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "public/art/rebrand";
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf-8")) as {
  production: boolean;
  files: string[];
  ages: string[];
  rooms: Record<string, string>;
};

describe("rebrand assets", () => {
  it("поставляет все 64 файла с ненулевым размером", () => {
    expect(manifest.production).toBe(false);
    expect(manifest.files).toHaveLength(64);
    for (const file of manifest.files) {
      expect(existsSync(`${root}/${file}`), file).toBe(true);
      expect(statSync(`${root}/${file}`).size, file).toBeGreaterThan(0);
    }
  });

  it("содержит 9 возрастов, 18 домов и 3 интерьера", () => {
    expect(manifest.ages).toHaveLength(9);
    expect(manifest.files.filter((file) => /^house-.*\.png$/.test(file))).toHaveLength(18);
    expect(Object.keys(manifest.rooms)).toEqual(["north", "temperate", "tropics"]);
    for (const signal of ["choice", "year", "inherit", "button", "menu", "favorite", "error", "death"]) {
      expect(manifest.files).toContain(`audio/${signal}.ogg`);
    }
  });
});
