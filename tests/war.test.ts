import { describe, expect, it } from "vitest";
import { advanceYear, applyChoice, pickConflictEvent } from "../src/core/turn.ts";
import type { ConflictData } from "../src/core/conflicts.ts";
import { names, newState } from "./helpers.ts";

const conflict: ConflictData = {
  code: 1,
  population: Array(151).fill(1_000_000),
  years: [{ year: 2020, civilians: 5000, parties: 10000, population: 1_000_000, source: "organized" }],
};

describe("военный риск героя", () => {
  it("мирные и боевые потери добавляются к обычной смертности отдельно", () => {
    const base = newState("war-hazard").s;
    base.birth.year = 2000;
    base.age = 20;
    const { mort, family } = newState("war-hazard");
    const baseQ = mort.q[base.birth.sex][2020 - 1950][20] / mort.scale;
    const N = 5000;
    let civilianDeaths = 0;
    let combatDeaths = 0;
    for (let i = 0; i < N; i++) {
      const civilian = structuredClone(base);
      civilian.seed = `civilian-${i}`;
      advanceYear(civilian, mort, family, names, conflict);
      if (!civilian.alive) civilianDeaths++;
      const combat = structuredClone(base);
      combat.seed = `combat-${i}`;
      combat.war.heroCombat = true;
      advanceYear(combat, mort, family, names, conflict);
      if (!combat.alive) combatDeaths++;
    }
    expect(civilianDeaths / N).toBeCloseTo(baseQ + 0.005, 2);
    expect(combatDeaths / N).toBeCloseTo(baseQ + 0.015, 2);
  });

  it("переселение уменьшает мирный риск и истекает", () => {
    const { s, mort, family } = newState("war-displaced");
    s.birth.year = 2000;
    s.age = 20;
    s.war.displacedUntil = 2020;
    s.war.heroRisk = 0.5;
    advanceYear(s, mort, family, names, conflict);
    expect(s.war.displacedUntil).toBeNull();
    expect(s.war.heroRisk).toBe(1);
    expect(s.war.peopleRisk).toEqual({});
  });
});


describe("сцены конфликтов", () => {
  it("фаза показывается один раз, эвакуация до безопасности + год", () => {
    const { s } = newState("war-scene");
    s.birth.year = 2000;
    s.age = 20;
    const event = pickConflictEvent(s, conflict);
    expect(event?.id).toBe("war-start");
    applyChoice(s, event!, 1, names, conflict);
    expect(s.war.displacedUntil).toBe(2022);
    expect(s.war.heroRisk).toBe(0.75);
    expect(Object.values(s.war.peopleRisk).every((risk) => risk === 0.5)).toBe(true);
    expect(s.war.seen).toEqual([{ year: 2020, phase: "start" }]);
    expect(pickConflictEvent(s, conflict)).toBeNull();
    expect(s.people.some((p) => p.memories.some((m) => m.eventId === "war-start"))).toBe(true);
  });

  it("дети и soften получают гражданскую сцену вместо боевой", () => {
    const child = newState("war-child").s;
    child.birth.year = 2010;
    child.age = 10;
    expect(pickConflictEvent(child, conflict)?.id).toBe("war-start-civilian");
    const softened = newState("war-softened").s;
    softened.birth.year = 1990;
    softened.age = 30;
    softened.softenHeavy = true;
    expect(pickConflictEvent(softened, conflict)?.id).toBe("war-start-civilian");
  });

  it("защита повышает риск героя и уменьшает риск близких", () => {
    const { s } = newState("war-protect");
    s.birth.year = 1990;
    s.age = 30;
    const event = pickConflictEvent(s, conflict)!;
    applyChoice(s, event, 2, names, conflict);
    expect(s.war.heroRisk).toBe(1.5);
    expect(Object.values(s.war.peopleRisk).every((risk) => risk === 0.5)).toBe(true);
  });

  it("боевая роль только явным выбором взрослого", () => {
    const { s } = newState("war-combat");
    s.birth.year = 1990;
    s.age = 30;
    const event = pickConflictEvent(s, conflict)!;
    expect(s.war.heroCombat).toBe(false);
    applyChoice(s, event, 3, names, conflict);
    expect(s.war.heroCombat).toBe(true);
  });
});


describe("переселение близких", () => {
  it("только совместная эвакуация снижает риск близких через переселение", () => {
    const { s } = newState("war-together-flag");
    s.birth.year = 2000;
    s.age = 20;
    applyChoice(s, pickConflictEvent(s, conflict)!, 1, names, conflict);
    expect(s.war.peopleDisplaced).toBe(true);
    expect(Object.values(s.war.peopleRisk).every((risk) => risk === 0.5)).toBe(true);
    s.war.displacedUntil = 2020;
    const { mort, family } = newState("war-together-flag");
    advanceYear(s, mort, family, names, conflict);
    expect(s.war.peopleDisplaced).toBe(false);
  });

  it("оставшиеся после одиночной эвакуации не получают снижение переселения", () => {
    const { s } = newState("war-alone-flag");
    s.birth.year = 2000;
    s.age = 20;
    s.softenHeavy = true;
    const event = pickConflictEvent(s, conflict)!;
    applyChoice(s, event, 3, names, conflict);
    expect(s.war.peopleDisplaced).toBe(false);
    expect(Object.values(s.war.peopleRisk).every((risk) => risk === 1.5)).toBe(true);
  });
});
