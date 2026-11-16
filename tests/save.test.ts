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

describe("сейв v8", () => {
  it("сохраняет имущество, мемориал и политическую карьеру", () => {
    installStorage();
    const { s } = newState("save-v8");
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
    s.politics.career.experience.local = 2;
    s.politics.alternative.active = true;
    s.politics.alternative.gdpFactor = 1.005;
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

  it("v5 переносится через значения v6/v7 сразу в политику v8", () => {
    installStorage();
    const { s } = newState("migrate-v5");
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 5;
    legacy.focus = { ...s.focus, current: "hobby" };
    delete legacy.happinessHistory;
    delete legacy.focusTotals;
    delete legacy.favoriteMomentIndexes;
    delete legacy.politics;
    localStorage.setItem("earth:life:v5", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(8);
    expect(result.state?.focus.current).toBe("hobby");
    expect(result.state?.plan).toBeNull();
    expect(result.state?.property.rentals).toBe(0);
    expect(result.state?.happinessHistory).toEqual([{ age: 0, year: s.birth.year, value: 70 }]);
    expect(result.state?.politics.alternative.gdpFactor).toBe(1);
    expect(localStorage.getItem("earth:life:v5")).toBeNull();
    expect(localStorage.getItem("earth:life:v8")).not.toBeNull();
  });

  it("v6 сохраняет имущество, очищает избранное и добавляет политику", () => {
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
    localStorage.setItem("earth:life:v6", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(8);
    expect(result.state?.property.items).toEqual(["home"]);
    expect(result.state?.favoriteMomentIndexes).toEqual([0]);
    expect(result.state?.focusTotals).toEqual({});
    expect(result.state?.happinessHistory).toEqual([{ age: 24, year: s.birth.year + 24, value: s.happiness }]);
    expect(result.state?.politics.career.status).toBe("none");
    expect(localStorage.getItem("earth:life:v6")).toBeNull();
    expect(localStorage.getItem("earth:life:v8")).not.toBeNull();
  });

  it("v7 сохраняет мемориал и получает исходную политическую модель", () => {
    installStorage();
    const { s } = newState("migrate-v7");
    s.chronicle.push({ age: 10, year: s.birth.year + 10, text: "Момент", source: "hero" });
    s.favoriteMomentIndexes.push(0);
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    legacy.version = 7;
    delete legacy.politics;
    localStorage.setItem("earth:life:v7", JSON.stringify(legacy));
    const result = loadLife();
    expect(result.state?.version).toBe(8);
    expect(result.state?.favoriteMomentIndexes).toEqual([0]);
    expect(result.state?.politics.career.experience).toEqual({ local: 0, regional: 0, national: 0 });
    expect(result.state?.politics.alternative.changes).toEqual([]);
    expect(result.state?.finance.lastBreakdown.politics).toBe(0);
    expect(localStorage.getItem("earth:life:v7")).toBeNull();
    expect(localStorage.getItem("earth:life:v8")).not.toBeNull();
  });

  it("повреждённая восьмая версия не запускается", () => {
    installStorage();
    localStorage.setItem("earth:life:v8", JSON.stringify({ version: 8, seed: "bad" }));
    expect(loadLife().state).toBeNull();
    expect(localStorage.getItem("earth:life:v8")).toBeNull();
  });
});
