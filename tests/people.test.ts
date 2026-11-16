import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { annualSiblingBirthChance, bondsSummary, createFamily, householdMetric, remember } from "../src/core/people.ts";
import type { Birth, FamilyData, IndexData, NamesData } from "../src/core/types.ts";

const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));
const world: FamilyData = JSON.parse(readFileSync("public/data/family/_world.json", "utf-8"));

function fixture(iso3: string, year: number): { birth: Birth; family: FamilyData } {
  const country = index.countries.find((c) => c.iso3 === iso3)!;
  return {
    birth: { year, country, sex: "M", name: "Test" },
    family: JSON.parse(readFileSync(`public/data/family/${iso3}.json`, "utf-8")),
  };
}

describe("семейные данные ООН", () => {
  it.each(["RUS", "USA", "IND", "NGA"])("%s: возрастные вероятности рождений суммируются в TFR", (iso3) => {
    const { family } = fixture(iso3, 1990);
    for (const year of [1960, 1990, 2020, 2050]) {
      let total = 0;
      for (let age = 10; age <= 54; age++) total += annualSiblingBirthChance(family, year, age);
      expect(total).toBeCloseTo(family.tfr[year - 1950], 6);
    }
  });

  it.each([
    ["RUS", 1990],
    ["USA", 2020],
    ["IND", 1980],
    ["NGA", 1990],
  ] as const)("%s %s: состав семьи соответствует наблюдениям ООН", (iso3, year) => {
    const { birth, family } = fixture(iso3, year);
    const N = 5000;
    let children = 0;
    let single = 0;
    let motherAge = 0;
    for (let i = 0; i < N; i++) {
      const people = createFamily(`family-${i}`, birth, names, family, world);
      children += 1 + people.filter((p) => p.role === "sibling").length;
      if (people.filter((p) => (p.role === "mother" || p.role === "father") && p.present).length === 1) single++;
      motherAge += year - people.find((p) => p.role === "mother")!.birthYear;
    }
    const expectedChildren = householdMetric(family, world, year, "children").value;
    const expectedSingle = householdMetric(family, world, year, "singleParent").value;
    expect(children / N).toBeCloseTo(expectedChildren, 1);
    expect(single / N).toBeCloseTo(expectedSingle, 1);
    const weights = family.motherAge[year - 1950];
    const expectedMother = weights.reduce((sum, weight, i) => sum + weight * (10 + i * 5 + 2), 0);
    expect(Math.abs(motherAge / N - expectedMother)).toBeLessThan(0.25);
  });

  it("страна без наблюдений использует мировой fallback", () => {
    const empty: FamilyData = { code: -2, households: [], tfr: world.tfr, motherAge: world.motherAge };
    const actual = householdMetric(empty, world, 2000, "children");
    const expected = householdMetric(world, world, 2000, "children");
    expect(actual.value).toBe(expected.value);
    expect(actual.estimated).toBe(true);
  });
});

describe("отношения и память", () => {
  it("одинаковый seed создаёт одинаковую семью", () => {
    const { birth, family } = fixture("RUS", 1990);
    expect(createFamily("same", birth, names, family, world)).toEqual(createFamily("same", birth, names, family, world));
  });

  it("воспоминания не стираются, новые поступки могут восстановить отношения", () => {
    const { birth, family } = fixture("RUS", 1990);
    const people = createFamily("memory", birth, names, family, world);
    const mother = people[0];
    const initial = bondsSummary(people);
    remember(mother, 10, 2000, "conflict", "Ссора", -20, "conflict");
    const hurt = bondsSummary(people);
    remember(mother, 20, 2010, "care", "Забота", 25, "care");
    expect(mother.memories).toHaveLength(2);
    expect(hurt).toBeLessThan(initial);
    expect(bondsSummary(people)).toBeGreaterThan(hurt);
  });
});
