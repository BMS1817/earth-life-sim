import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rngFromSeed, weightedIndex } from "../src/core/rng.ts";
import { deathAgePeriod } from "../src/core/mortality.ts";
import { pickSex } from "../src/core/birth.ts";
import type { IndexData, MortData, Sex } from "../src/core/types.ts";

function loadMort(iso3: string): MortData {
  return JSON.parse(readFileSync(`public/data/mort/${iso3}.json`, "utf-8"));
}

const N = 20_000;
const TOLERANCE = 0.5;

describe("смертность против e0 из WPP", () => {
  for (const iso3 of ["RUS", "USA", "JPN", "IND", "NGA"]) {
    const mort = loadMort(iso3);
    for (const year of [1960, 2020]) {
      for (const sex of ["M", "F"] as Sex[]) {
        it(`${iso3} ${sex} ${year}: средний возраст смерти ≈ e0 ±${TOLERANCE}`, () => {
          const rng = rngFromSeed(`test-${iso3}-${sex}-${year}`);
          let total = 0;
          for (let i = 0; i < N; i++) total += deathAgePeriod(rng, mort, sex, year);
          const mean = total / N;
          const e0 = mort.e0[sex][year - 1950];
          expect(Math.abs(mean - e0)).toBeLessThanOrEqual(TOLERANCE);
        });
      }
    }
  }
});

describe("ядро", () => {
  it("одинаковый seed даёт одинаковую последовательность", () => {
    const a = rngFromSeed("same-seed");
    const b = rngFromSeed("same-seed");
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("weightedIndex выбирает пропорционально весам", () => {
    const rng = rngFromSeed("weights");
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[weightedIndex(rng, [1, 3, 6])]++;
    expect(counts[0] / 30_000).toBeCloseTo(0.1, 1);
    expect(counts[1] / 30_000).toBeCloseTo(0.3, 1);
    expect(counts[2] / 30_000).toBeCloseTo(0.6, 1);
  });

  it("пол при рождении соответствует SRB", () => {
    const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
    const rus = index.countries.find((c) => c.iso3 === "RUS")!;
    const srb = rus.srb[2000 - 1950];
    const rng = rngFromSeed("sex-rus");
    let male = 0;
    for (let i = 0; i < 30_000; i++) if (pickSex(rng, srb) === "M") male++;
    expect(male / 30_000).toBeCloseTo(srb / (1 + srb), 2);
  });
});
