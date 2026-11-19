import { afterEach, describe, expect, it } from "vitest";
import { clearLife, loadLife, saveLife } from "../src/core/save.ts";
import { newState } from "./helpers.ts";

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installStorage(): void {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("сейв v10", () => {
  it("сохраняет имущество, мемориал, политику и род", () => {
    installStorage();
    const { s } = newState("save-v10");
    s.plan = { kind: "courses", remainingYears: 1, dreamCareer: null };
    s.hobbies.push({ id: "games", xp: 4, level: 3 });
    s.pets.push({ id: "dog-0", kind: "dog", name: "Чарли", adoptedYear: 2020, deathYear: null, lifespan: 12 });
    s.property.items.push("computer");
    s.property.rentals = 1;
    s.chronicle.push({ age: 0, year: s.birth.year, text: "Первый момент", source: "hero" });
    s.favoriteMomentIndexes.push(0);
    s.politics.trainingComplete = true;
    s.politics.career.status = "inOffice";
    s.politics.career.level = "local";
    s.politics.alternative.active = true;
    s.lineage.generation = 3;
    s.lineage.lastInheritance = { year: 2050, parentName: "A", heirName: "B", childrenCount: 2, cashShare: 100, bondsShare: 50, riskyShare: 25, insurance: 200, rentals: 1, business: true, education: 15, trait: "warm" };
    saveLife(s);
    expect(loadLife().state).toEqual(s);
    expect(loadLife().legacyDiscarded).toBe(false);
    clearLife();
    expect(loadLife().state).toBeNull();
  });

  it.each(["earth:life:v1", "earth:life:v2", "earth:life:v3", "earth:life:v4"])("старый сейв %s отклоняется с флагом", (key) => {
    installStorage();
    const { s } = newState("legacy-save");
    localStorage.setItem(key, JSON.stringify(s));
    const result = loadLife();
    expect(result.state).toBeNull();
    expect(result.legacyDiscarded).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("v5 переносится через значения v6/v7/v8/v9 сразу в род v10", () => {
    installStorage();
    const { s } = newState("migrate-v5");
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 5;
    legacy.focus = { ...s.focus, current: "hobby" };
    delete legacy.happinessHistory;
    delete legacy.focusTotals;
    delete legacy.favoriteMomentIndexes;
    delete legacy.politics;
    delete legacy.lineage;
    localStorage.setItem("earth:life:v5", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(10);
    expect(result.state?.focus.current).toBe("happiness");
    expect(result.state?.plan).toBeNull();
    expect(result.state?.property.rentals).toBe(0);
    expect(result.state?.happinessHistory).toEqual([{ age: 0, year: s.birth.year, value: 70 }]);
    expect(result.state?.politics.alternative.gdpFactor).toBe(1);
    expect(result.state?.lineage.generation).toBe(1);
    expect(localStorage.getItem("earth:life:v5")).toBeNull();
    expect(localStorage.getItem("earth:life:v10")).not.toBeNull();
  });

  it("v6 сохраняет имущество и добавляет политику и род", () => {
    installStorage();
    const { s } = newState("migrate-v6");
    s.age = 24;
    s.chronicle.push({ age: 18, year: s.birth.year + 18, text: "Работа", source: "hero" });
    s.property.items.push("home");
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 6;
    legacy.favoriteMomentIndexes = [0, 0, 99, -1];
    delete legacy.happinessHistory;
    delete legacy.focusTotals;
    delete legacy.politics;
    delete legacy.lineage;
    localStorage.setItem("earth:life:v6", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(10);
    expect(result.state?.property.items).toEqual(["home"]);
    expect(result.state?.favoriteMomentIndexes).toEqual([0]);
    expect(result.state?.politics.career.status).toBe("none");
    expect(result.state?.lineage.generation).toBe(1);
    expect(localStorage.getItem("earth:life:v6")).toBeNull();
    expect(localStorage.getItem("earth:life:v10")).not.toBeNull();
  });

  it("v7 сохраняет мемориал и получает политическую модель и род", () => {
    installStorage();
    const { s } = newState("migrate-v7");
    s.chronicle.push({ age: 10, year: s.birth.year + 10, text: "Момент", source: "hero" });
    s.favoriteMomentIndexes.push(0);
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 7;
    delete legacy.politics;
    delete legacy.lineage;
    localStorage.setItem("earth:life:v7", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(10);
    expect(result.state?.favoriteMomentIndexes).toEqual([0]);
    expect(result.state?.politics.career.experience).toEqual({ local: 0, regional: 0, national: 0 });
    expect(result.state?.lineage.generation).toBe(1);
    expect(result.state?.finance.lastBreakdown.politics).toBe(0);
    expect(localStorage.getItem("earth:life:v7")).toBeNull();
    expect(localStorage.getItem("earth:life:v10")).not.toBeNull();
  });

  it("v8 сохраняет политику и получает род с чертами героя", () => {
    installStorage();
    const { s } = newState("migrate-v8");
    s.politics.career.lastLevel = "national";
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 8;
    delete legacy.lineage;
    localStorage.setItem("earth:life:v8", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(10);
    expect(result.state?.politics.career.lastLevel).toBe("national");
    expect(result.state?.lineage.generation).toBe(1);
    expect(result.state?.lineage.ancestors).toEqual([]);
    expect(result.state?.lineage.heroTraits).toHaveLength(3);
    expect(result.state?.lineage.lastInheritance).toBeNull();
    expect(localStorage.getItem("earth:life:v8")).toBeNull();
    expect(localStorage.getItem("earth:life:v10")).not.toBeNull();
  });

  it("v9 переносит прежние фокусы и накопленные доли в новую матрицу", () => {
    installStorage();
    const { s } = newState("migrate-v9-focus");
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 9;
    legacy.focus = { ...s.focus, current: "study" };
    legacy.focusTotals = { study: 2, growth: 1, work: 1, rest: 1, relationships: 1 };
    localStorage.setItem("earth:life:v9", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(10);
    expect(result.state?.focus.current).toBe("education");
    expect(result.state?.focusTotals).toEqual({ education: 3, money: 1, happiness: 1, bonds: 1 });
    expect(localStorage.getItem("earth:life:v9")).toBeNull();
    expect(localStorage.getItem("earth:life:v10")).not.toBeNull();
  });

  it("повреждённая десятая версия не запускается", () => {
    installStorage();
    localStorage.setItem("earth:life:v10", JSON.stringify({ version: 10, seed: "bad" }));
    expect(loadLife().state).toBeNull();
    expect(localStorage.getItem("earth:life:v10")).toBeNull();
  });
});
