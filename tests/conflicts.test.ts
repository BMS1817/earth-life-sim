import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { conflictForYear, conflictHazard, conflictPhase, riskLevel } from "../src/core/conflicts.ts";
import type { ConflictData } from "../src/core/conflicts.ts";

function load(iso3: string): ConflictData {
  return JSON.parse(readFileSync(`public/data/conflicts/${iso3}.json`, "utf-8"));
}

describe("данные конфликтов UCDP", () => {
  it("Афганистан 1989 совпадает с Organized Violence CY", () => {
    const row = load("AFG").years.find((r) => r.year === 1989)!;
    expect(row.civilians).toBe(4346);
    expect(row.parties).toBe(1065);
    expect(row.population).toBe(11873999);
    expect(row.source).toBe("organized");
  });

  it("мирные строки не считаются активными конфликтами", () => {
    expect(load("JPN").years).toHaveLength(0);
    expect(conflictForYear(load("JPN"), "peace", 2020)).toBeNull();
  });

  it("республики делят исторический риск по населению без изменения ставки", () => {
    const rus = load("RUS").years.find((r) => r.year === 1956)!;
    const ukr = load("UKR").years.find((r) => r.year === 1956)!;
    const rusRate = (rus.civilians + rus.parties) / rus.population;
    const ukrRate = (ukr.civilians + ukr.parties) / ukr.population;
    expect(ukrRate).toBeCloseTo(rusRate, 6);
  });

  it("будущий сценарий соответствует частоте последних 10 лет и не выдаётся за историю", () => {
    const usa = load("USA");
    let active = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const row = conflictForYear(usa, `future-${i}`, 2030);
      if (row) {
        active++;
        expect(row.source).toBe("scenario");
      }
    }
    expect(active / N).toBeCloseTo(0.5, 1);
  });
});

describe("фазы и риск", () => {
  const data: ConflictData = {
    code: 1,
    population: Array(151).fill(1_000_000),
    years: [
      { year: 2000, civilians: 40, parties: 60, population: 1_000_000, source: "organized" },
      { year: 2001, civilians: 160, parties: 240, population: 1_000_000, source: "organized" },
      { year: 2002, civilians: 10, parties: 20, population: 1_000_000, source: "organized" },
    ],
  };

  it("начало, усиление, ослабление и завершение", () => {
    expect(conflictPhase(data, "x", 2000)).toBe("start");
    expect(conflictPhase(data, "x", 2001)).toBe("escalation");
    expect(conflictPhase(data, "x", 2002)).toBe("deescalation");
    expect(conflictPhase(data, "x", 2003)).toBe("end");
    expect(conflictPhase(data, "x", 2004)).toBe("peace");
  });

  it("hazard делится на население, уровень риска относится к обычной смертности", () => {
    const hazard = conflictHazard(data.years[0]);
    expect(hazard.civilian).toBeCloseTo(0.00004, 8);
    expect(hazard.parties).toBeCloseTo(0.00006, 8);
    expect(riskLevel(hazard.civilian, 0.001)).toBe("low");
    expect(riskLevel(hazard.civilian, 0.0002)).toBe("noticeable");
    expect(riskLevel(hazard.civilian, 0.00002)).toBe("high");
  });
});
