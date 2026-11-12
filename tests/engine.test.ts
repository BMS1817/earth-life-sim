import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBirth } from "../src/core/life.ts";
import { rngFromSeed } from "../src/core/rng.ts";
import { applyChoice, advanceYear, createLifeState, pickYearEvents } from "../src/core/turn.ts";
import { mortalityMultiplier } from "../src/core/state.ts";
import { compassPosition } from "../src/core/state.ts";
import type { LifeState } from "../src/core/state.ts";
import { EVENTS } from "../src/content/events.ts";
import type { IndexData, MortData, NamesData } from "../src/core/types.ts";

const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));
const income = JSON.parse(readFileSync("public/data/income.json", "utf-8"));

function newState(seed: string): { s: LifeState; mort: MortData } {
  const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
  const mort: MortData = JSON.parse(readFileSync(`public/data/mort/${birth.country.iso3}.json`, "utf-8"));
  const gdpTable = income.gdp[birth.country.iso3] ?? income.gdp._world;
  const gdp = gdpTable[Math.min(birth.year, 2022) - 1950];
  return { s: createLifeState(seed, birth, gdp), mort };
}

function autoPlay(seed: string): LifeState {
  const { s, mort } = newState(seed);
  let guard = 0;
  while (s.alive && guard++ < 200) {
    const events = pickYearEvents(s, EVENTS);
    if (events.length > 0) applyChoice(s, events[0], 0);
    advanceYear(s, mort);
  }
  return s;
}

describe("движок жизни", () => {
  it("полный прогон детерминирован по seed", () => {
    const a = autoPlay("determinism-1");
    const b = autoPlay("determinism-1");
    expect(a.deathYear).toBe(b.deathYear);
    expect(a.age).toBe(b.age);
    expect(a.chronicle).toEqual(b.chronicle);
    expect(a.compass).toEqual(b.compass);
  });

  it("жизнь заканчивается, возраст смерти в пределах 0–100", () => {
    for (const seed of ["life-a", "life-b", "life-c"]) {
      const s = autoPlay(seed);
      expect(s.alive).toBe(false);
      expect(s.age).toBeGreaterThanOrEqual(0);
      expect(s.age).toBeLessThanOrEqual(100);
      expect(s.deathYear).toBe(s.birth.year + s.age);
    }
  });

  it("суммарный множитель смертности ограничен ×0.5–×2", () => {
    const { s } = newState("cap-test");
    s.modifiers = [
      { id: "a", mult: 0.3, untilAge: null },
      { id: "b", mult: 0.3, untilAge: null },
    ];
    expect(mortalityMultiplier(s)).toBe(0.5);
    s.modifiers = [
      { id: "a", mult: 3, untilAge: null },
      { id: "b", mult: 3, untilAge: null },
    ];
    expect(mortalityMultiplier(s)).toBe(2);
  });

  it("истёкший модификатор не действует", () => {
    const { s } = newState("expiry-test");
    s.modifiers = [{ id: "a", mult: 2, untilAge: 10 }];
    s.age = 9;
    expect(mortalityMultiplier(s)).toBe(2);
    s.age = 10;
    expect(mortalityMultiplier(s)).toBe(1);
  });

  it("веховое событие появляется на своём возрасте и только один раз", () => {
    const { s } = newState("milestone-test");
    s.age = 6;
    const events = pickYearEvents(s, EVENTS);
    expect(events.some((e) => e.id === "first-grade")).toBe(true);
    expect(events.length).toBeGreaterThan(1);
    s.usedEventIds.push("first-grade");
    s.age = 6;
    expect(pickYearEvents(s, EVENTS).some((e) => e.id === "first-grade")).toBe(false);
  });

  it("тяжёлые события отфильтровываются в режиме «смягчить»", () => {
    const { s } = newState("soften-test");
    s.age = 75;
    s.softenHeavy = true;
    for (let i = 0; i < 50; i++) {
      expect(pickYearEvents(s, EVENTS).every((e) => !e.heavy)).toBe(true);
    }
  });

  it("компас нормируется по числу выборов и ограничен ±1", () => {
    expect(compassPosition(5, 10)).toBe(0.5);
    expect(compassPosition(-20, 10)).toBe(-1);
    expect(compassPosition(3, 4)).toBe(0.75);
    expect(compassPosition(0, 0)).toBe(0);
  });

  it("младенческая смертность по всему миру соответствует q0", () => {
    const mortCache = new Map<string, MortData>();
    let deaths = 0;
    let q0sum = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const { s } = newState(`infant-${i}`);
      const cached = mortCache.get(s.birth.country.iso3);
      const m: MortData = cached ?? JSON.parse(readFileSync(`public/data/mort/${s.birth.country.iso3}.json`, "utf-8"));
      if (!cached) mortCache.set(s.birth.country.iso3, m);
      q0sum += m.q[s.birth.sex][Math.min(s.birth.year, 2100) - 1950][0] / m.scale;
      advanceYear(s, m);
      if (!s.alive) deaths++;
    }
    // Допуск ±0.015 ≈ 3σ для N=3000 при p≈0.07.
    expect(Math.abs(deaths / N - q0sum / N)).toBeLessThan(0.015);
  });

  it("риск срабатывает с заданной вероятностью", () => {
    const event = EVENTS.find((e) => e.id === "after-school")!;
    const choiceIndex = 2;
    const base = createLifeState("risk-base", createBirth(rngFromSeed("risk-base:birth"), index, names), 5000);
    base.age = 18;
    let success = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const s: LifeState = { ...base, seed: `risk-${i}`, chronicle: [], scales: { ...base.scales } };
      applyChoice(s, event, choiceIndex);
      if (s.scales.money > base.scales.money) success++;
    }
    expect(success / N).toBeCloseTo(0.6, 1);
  });
});
