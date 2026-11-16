import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { politicsYear } from "../src/core/politics.ts";
import type { PoliticsData } from "../src/core/politics.ts";
import { index } from "./helpers.ts";

function profile(iso3: string): PoliticsData {
  return JSON.parse(readFileSync(`public/data/politics/${iso3}.json`, "utf-8"));
}

describe("профили политики V-Dem", () => {
  it("покрывает все 236 стран и территорий полными рядами 1950–2025", () => {
    expect(index.countries).toHaveLength(236);
    const forms = new Set<number>();
    for (const country of index.countries) {
      const data = profile(country.iso3);
      expect(data.iso3).toBe(country.iso3);
      expect(data.license).toBe("CC BY-SA 4.0");
      expect(data.years).toEqual([1950, 2025]);
      for (const key of ["regime", "polyarchy", "liberal", "elected", "form", "leader", "termYears", "termLimits", "estimated"] as const) {
        expect(data[key], `${country.iso3}.${key}`).toHaveLength(76);
      }
      expect(data.regime.every((value) => value >= 0 && value <= 3)).toBe(true);
      expect(data.polyarchy.every((value) => value >= 0 && value <= 1)).toBe(true);
      expect(data.liberal.every((value) => value >= 0 && value <= 1)).toBe(true);
      expect(data.estimated.every((value) => value === 0 || value === 1)).toBe(true);
      for (const elections of Object.values(data.elections)) {
        expect(elections.every((year, index) => year >= 1950 && year <= 2025 && (index === 0 || year > elections[index - 1]))).toBe(true);
      }
      for (const form of data.form) forms.add(form);
    }
    expect(forms).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("сохраняет фактические значения источника и помечает fallback", () => {
    const usa = profile("USA");
    const usa2024 = politicsYear(usa, 2024);
    expect(usa2024.polyarchy).toBeCloseTo(0.843);
    expect(usa2024.regime).toBe(3);
    expect(usa2024.constitution.form).toBe("presidential");
    expect(usa2024.estimated).toBe(false);
    expect(usa.elections.presidential).toContain(2024);
    expect(politicsYear(usa, 1974).constitution.form).toBe("presidential");

    const ukraine = politicsYear(profile("UKR"), 1989);
    expect(ukraine.estimated).toBe(true);
    expect(ukraine.constitution.form).toBe(politicsYear(profile("RUS"), 1989).constitution.form);
    expect(politicsYear(profile("AND"), 2020).estimated).toBe(true);
    expect(politicsYear(profile("X412"), 2021).estimated).toBe(false);
    expect(politicsYear(usa, 2030).scenario).toBe(true);
  });
});
