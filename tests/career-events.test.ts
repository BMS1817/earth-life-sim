import { describe, expect, it } from "vitest";
import { applyChoice, pickYearEvents } from "../src/core/turn.ts";
import { processFinanceYear } from "../src/core/finance.ts";
import { EVENTS } from "../src/content/events.ts";
import { names, newState } from "./helpers.ts";

describe("карьерные события", () => {
  it("на 18 выбирается настоящая профессия и начинается доход", () => {
    const { s } = newState("career-start");
    s.age = 18;
    const event = pickYearEvents(s, EVENTS).find((e) => e.id === "after-school")!;
    expect(event.choices).toHaveLength(4);
    expect(event.choices.every((choice) => choice.career)).toBe(true);
    applyChoice(s, event, 0, names);
    expect(s.finance.career).not.toBeNull();
    expect(s.finance.employment).toBe("employed");
    expect(s.finance.careerStartYear).toBe(s.birth.year + 18);
  });

  it("безработица заканчивается через два года", () => {
    const { s } = newState("unemployment");
    s.age = 30;
    const event = EVENTS.find((e) => e.id === "job-crisis")!;
    applyChoice(s, event, 3, names);
    expect(s.finance.employment).toBe("unemployed");
    processFinanceYear(s, s.birth.year + 31);
    expect(s.finance.employment).toBe("unemployed");
    processFinanceYear(s, s.birth.year + 32);
    expect(s.finance.employment).toBe("employed");
  });

  it("показывает путь к медицине через работу мечты", () => {
    const { s } = newState("career-dream-hint");
    s.age = 18;
    const event = pickYearEvents(s, EVENTS).find((e) => e.id === "after-school")!;
    expect(event.text).toContain("работу мечты");
    expect(event.text).toContain("Образ жизни");
  });

  it("не предлагает повышение после пятого уровня", () => {
    const { s } = newState("career-promotion-cap");
    const event = EVENTS.find((e) => e.id === "adult-promotion")!;
    s.finance.careerLevel = 4;
    expect(event.condition?.(s)).toBe(true);
    s.finance.careerLevel = 5;
    expect(event.condition?.(s)).toBe(false);
  });

  it("кризис работы происходит один раз за жизнь", () => {
    const { s } = newState("career-crisis-once");
    const event = EVENTS.find((e) => e.id === "job-crisis")!;
    expect(event.once).toBe(true);
    applyChoice(s, event, 1, names);
    expect(s.usedEventIds).toContain("job-crisis");
  });

  it("ипотека выбирается через событие", () => {
    const { s } = newState("mortgage-choice");
    s.age = 35;
    const event = EVENTS.find((e) => e.id === "adult-mortgage")!;
    applyChoice(s, event, 0, names);
    expect(s.finance.housing).toBe("mortgage");
    expect(s.finance.mortgageYearsLeft).toBe(15);
  });
});
