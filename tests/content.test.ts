import { describe, expect, it } from "vitest";
import { EVENTS } from "../src/content/events.ts";
import { createLifeState } from "../src/core/turn.ts";
import { createBirth } from "../src/core/life.ts";
import { rngFromSeed } from "../src/core/rng.ts";
import { readFileSync } from "node:fs";
import type { IndexData, NamesData } from "../src/core/types.ts";

const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));

describe("контент событий", () => {
  it("id уникальны", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("каждое событие имеет текст и ровно 4 выбора по 4 разным секторам", () => {
    for (const e of EVENTS) {
      expect(e.text.length).toBeGreaterThan(10);
      expect(e.choices.length, e.id).toBe(4);
      const sectors = new Set(e.choices.map((c) => c.sector));
      expect(sectors.size, e.id).toBe(4);
      for (const c of e.choices) {
        const hasOutcome = c.outcome.length > 0 || (c.risk && c.risk.successText.length > 0);
        expect(hasOutcome, `${e.id}`).toBe(true);
        if (c.risk) {
          expect(c.risk.chance).toBeGreaterThan(0);
          expect(c.risk.chance).toBeLessThan(1);
        }
        if (c.mortality) {
          expect(c.mortality.mult).toBeGreaterThanOrEqual(0.8);
          expect(c.mortality.mult).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it("у каждого выбора есть трейд-офф: минус в эффектах или в успехе риска", () => {
    const hasNegative = (effects?: Record<string, number>) =>
      !!effects && Object.values(effects).some((v) => v < 0);
    for (const e of EVENTS) {
      for (const c of e.choices) {
        const effects = c.risk ? c.risk.successEffects : c.effects;
        expect(hasNegative(effects), `${e.id} / ${c.label}`).toBe(true);
      }
    }
  });

  it("на каждом возрасте есть хотя бы одно событие", () => {
    const birth = createBirth(rngFromSeed("coverage:birth"), index, names);
    const s = createLifeState("coverage", birth, 5000);
    const missing: number[] = [];
    for (let age = 0; age <= 100; age++) {
      s.age = age;
      if (!EVENTS.some((e) => age >= e.minAge && age <= e.maxAge)) missing.push(age);
    }
    expect(missing).toEqual([]);
  });

  it("на вехах 6/12/16/18 доступно минимум 2 события", () => {
    for (const age of [6, 12, 16, 18]) {
      const n = EVENTS.filter((e) => age >= e.minAge && age <= e.maxAge).length;
      expect(n, `age ${age}`).toBeGreaterThanOrEqual(2);
    }
  });
});
