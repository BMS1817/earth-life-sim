import { describe, expect, it } from "vitest";
import { createLineageState, eligibleHeirs, inheritLife } from "../src/core/inheritance.ts";
import { createPerson } from "../src/core/people.ts";
import { names, newState, worldFamily } from "./helpers.ts";

function parentWithChildren(seed = "inherit-main") {
  const { s, mort, family, politics } = newState(seed);
  s.alive = false;
  s.age = 60;
  s.deathYear = s.birth.year + 60;
  s.finance.cash = 9000;
  s.finance.bonds = 3000;
  s.finance.risky = 1500;
  s.finance.gdpPerCapita = 5000;
  s.scales.education = 90;
  s.property.items = ["computer", "home"];
  s.property.acquired = { computer: 1990, home: 1995 };
  s.property.rentals = 3;
  s.property.business = { kind: "shop", startedYear: 2000, successfulYears: 8, level: 3 };
  s.pets = [
    { id: "dog-0", kind: "dog", name: "Чарли", adoptedYear: 2000, deathYear: null, lifespan: 20 },
    { id: "cat-0", kind: "cat", name: "Луна", adoptedYear: 1990, deathYear: 2010, lifespan: 20 },
  ];
  s.lifestyle.insurance = true;
  s.hobbies.push({ id: "music", xp: 22, level: 6 });
  s.chronicle.push({ age: 40, year: s.birth.year + 40, text: "Главный момент", source: "hero" });
  s.favoriteMomentIndexes.push(0);
  s.people.push(createPerson(`${seed}:child-0`, s.birth, names, "child-0", "child", "M", s.deathYear - 25, 80));
  s.people.push(createPerson(`${seed}:child-1`, s.birth, names, "child-1", "child", "F", s.deathYear - 20, 75));
  s.people.push(createPerson(`${seed}:sibling-0`, s.birth, names, "sibling-0", "sibling", "F", s.birth.year - 2, 60));
  s.politics.alternative.gdpFactor = 1.005;
  s.politics.alternative.mortalityFactor = 1.005;
  return { s, mort, family, politics };
}

describe("наследие поколений", () => {
  it("делит деньги и аренду, передаёт имущество, навыки, мир и род", () => {
    const { s, family, politics } = parentWithChildren();
    const result = inheritLife(s, "child-0", family, names, worldFamily, politics)!;
    expect(result).not.toBeNull();
    const { state, report } = result;
    expect(state.lineage.generation).toBe(2);
    expect(state.age).toBe(25);
    expect(state.seed).toBe(`${s.seed}:child-0:2`);
    expect(report.childrenCount).toBe(2);
    expect(state.finance.cash).toBe(14500);
    expect(state.finance.bonds).toBe(1500);
    expect(state.finance.risky).toBe(750);
    expect(state.property.rentals).toBe(2);
    expect(state.property.business).toEqual(s.property.business);
    expect(state.property.items).toEqual(["computer", "home"]);
    expect(state.pets.map((pet) => pet.id)).toEqual(["dog-0"]);
    expect(state.lifestyle.insurance).toBe(false);
    expect(state.scales.education).toBe(18);
    expect(state.hobbies[0].xp).toBe(11);
    expect(state.hobbies[0].level).toBe(5);
    expect(state.lineage.heroTraits).toContain(report.trait);
    expect(state.lineage.ancestors).toHaveLength(1);
    expect(state.lineage.ancestors[0].moments[0].text).toBe("Главный момент");
    expect(state.politics.alternative.gdpFactor).toBe(1.005);
    expect(state.politics.career.status).toBe("none");
    expect(state.politics.trainingComplete).toBe(false);
    expect(state.people.some((person) => person.id === "child-0")).toBe(false);
    expect(state.people.find((person) => person.id === "child-1")?.role).toBe("sibling");
    expect(state.people.find((person) => person.id === "sibling-0")?.role).toBe("relative");
    expect(state.people.find((person) => person.id === "mother")?.role).toBe("grandparent");
    expect(state.people.find((person) => person.id === "hero-1")?.alive).toBe(false);
    expect(state.lastOutcomeKind).toBe("life");
  });

  it("не делит активы с умершими детьми и не повторяет выплату", () => {
    const { s, family, politics } = parentWithChildren("inherit-single");
    s.people.find((person) => person.id === "child-1")!.alive = false;
    s.lifestyle.insurance = false;
    const { state } = inheritLife(s, "child-0", family, names, worldFamily, politics)!;
    expect(state.finance.cash).toBe(9000);
    expect(state.property.rentals).toBe(3);
    expect(eligibleHeirs(state)).toHaveLength(0);
    expect(inheritLife(state, "child-1", family, names, worldFamily, politics)).toBeNull();
  });

  it("отклоняет переход без смерти и без живого наследника", () => {
    const { s, family, politics } = parentWithChildren("inherit-invalid");
    expect(inheritLife(s, "missing", family, names, worldFamily, politics)).toBeNull();
    s.alive = true;
    expect(inheritLife(s, "child-0", family, names, worldFamily, politics)).toBeNull();
  });

  it("детерминирована и не меняет исходную жизнь", () => {
    const { s, family, politics } = parentWithChildren("inherit-deterministic");
    const before = JSON.stringify(s);
    const first = inheritLife(s, "child-0", family, names, worldFamily, politics)!;
    const second = inheritLife(s, "child-0", family, names, worldFamily, politics)!;
    expect(first.state).toEqual(second.state);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("первая жизнь начинается с первого поколения", () => {
    expect(createLineageState("seed").generation).toBe(1);
    expect(createLineageState("seed").heroTraits).toHaveLength(3);
  });
});
