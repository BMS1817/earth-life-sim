import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advancePeople, createPerson } from "../src/core/people.ts";
import type { Birth, FamilyData, IndexData, MortData, NamesData } from "../src/core/types.ts";

const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));
const family: FamilyData = JSON.parse(readFileSync("public/data/family/RUS.json", "utf-8"));
const mort: MortData = JSON.parse(readFileSync("public/data/mort/RUS.json", "utf-8"));
const country = index.countries.find((c) => c.iso3 === "RUS")!;
const birth: Birth = { year: 2000, country, sex: "M", name: "Test" };

describe("смертность близких", () => {
  it("младенческая смертность NPC соответствует q0 WPP", () => {
    const N = 5000;
    const noBirths: FamilyData = { ...family, tfr: family.tfr.map(() => 0) };
    let deaths = 0;
    for (let i = 0; i < N; i++) {
      const person = createPerson(`npc-${i}`, birth, names, "friend-0", "friend", "M", 2000);
      const news = advancePeople(`npc-${i}`, birth, names, noBirths, [person], mort, 2000);
      if (news.some((item) => item.kind === "death")) deaths++;
    }
    const q0 = mort.q.M[2000 - 1950][0] / mort.scale;
    expect(Math.abs(deaths / N - q0)).toBeLessThan(0.015);
  });

  it("смерть и новости детерминированы", () => {
    const run = () => {
      const person = createPerson("same-npc", birth, names, "friend-0", "friend", "M", 1950);
      const news = advancePeople("same-npc", birth, names, family, [person], mort, 2000);
      return { person, news };
    };
    expect(run()).toEqual(run());
  });
});
