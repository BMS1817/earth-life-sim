import { describe, expect, it } from "vitest";
import { applyChoice, advanceYear, pickYearEvents } from "../src/core/turn.ts";
import { mortalityMultiplier } from "../src/core/state.ts";
import type { LifeState } from "../src/core/state.ts";
import { compassPosition } from "../src/core/state.ts";
import { EVENTS } from "../src/content/events.ts";
import { autoPlay, names, newState } from "./helpers.ts";

describe("движок жизни", () => {
  it("полный прогон детерминирован по seed", () => {
    const a = autoPlay("determinism-1");
    const b = autoPlay("determinism-1");
    expect(a.deathYear).toBe(b.deathYear);
    expect(a.age).toBe(b.age);
    expect(a.chronicle).toEqual(b.chronicle);
    expect(a.compass).toEqual(b.compass);
    expect(a.people).toEqual(b.people);
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
    let deaths = 0;
    let q0sum = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const { s, mort, family } = newState(`infant-${i}`);
      q0sum += mort.q[s.birth.sex][Math.min(s.birth.year, 2100) - 1950][0] / mort.scale;
      advanceYear(s, mort, family, names);
      if (!s.alive) deaths++;
    }
    expect(Math.abs(deaths / N - q0sum / N)).toBeLessThan(0.015);
  }, 15000);

  it("риск срабатывает с заданной вероятностью", () => {
    const event = EVENTS.find((e) => e.id === "after-school")!;
    const choiceIndex = 2;
    const base = newState("risk-base").s;
    base.age = 18;
    let success = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const s: LifeState = structuredClone(base);
      s.seed = `risk-${i}`;
      applyChoice(s, event, choiceIndex, names);
      if (s.scales.money > base.scales.money) success++;
    }
    expect(success / N).toBeCloseTo(0.6, 1);
  });
});
