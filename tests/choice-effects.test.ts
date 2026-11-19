import { describe, expect, it } from "vitest";
import { ALL_EVENTS } from "../src/content/events.ts";

const mapping = {
  tradition: ["health", "money"],
  change: ["education", "bonds"],
  bonds: ["bonds", "health"],
  self: ["money", "education"],
} as const;

describe("уникальные последствия секторов", () => {
  it("каждый сектор имеет свой основной плюс и побочный минус без дублей в событии", () => {
    expect(ALL_EVENTS.length).toBeGreaterThan(100);
    for (const event of ALL_EVENTS) {
      const signatures = new Set<string>();
      for (const choice of event.choices) {
        const expected = mapping[choice.sector];
        expect(expected, `${event.id}: ${choice.sector}`).toBeDefined();
        for (const [kind, effects] of [["effects", choice.effects], ["success", choice.risk?.successEffects], ["fail", choice.risk?.failEffects]] as const) {
          if (!effects) continue;
          const [plus, minus] = expected;
          expect(Object.keys(effects).sort(), `${event.id}/${kind}`).toEqual([...expected].sort());
          if (kind === "fail") {
            expect(effects[plus]).toBeLessThan(0);
            expect(effects[minus]).toBeLessThan(0);
          } else {
            expect(effects[plus]).toBeGreaterThan(0);
            expect(effects[minus]).toBeLessThan(0);
          }
          expect(Math.abs(effects[plus]!)).toBeGreaterThanOrEqual(1);
          expect(Math.abs(effects[minus]!)).toBeGreaterThanOrEqual(1);
        }
        const effects = choice.risk?.successEffects ?? choice.effects ?? {};
        const signature = Object.entries(effects).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}${value >= 0 ? "+" : "-"}`).join(",");
        expect(signatures.has(signature), `${event.id}: повтор ${signature}`).toBe(false);
        signatures.add(signature);
      }
    }
  });
});
