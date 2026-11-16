import { describe, expect, it } from "vitest";
import { startPlan } from "../src/core/plans.ts";
import { advanceYear } from "../src/core/turn.ts";
import { names, newState } from "./helpers.ts";

describe("отложенные планы", () => {
  it("поиск работы даёт результат на следующий год и не дублируется", () => {
    const { s, mort, family } = newState("plan-job");
    s.age = 18;
    expect(startPlan(s, "jobSearch")).toBe(true);
    expect(startPlan(s, "courses")).toBe(false);
    expect(s.finance.employment).not.toBe("employed");
    advanceYear(s, mort, family, names);
    expect(s.plan).toBeNull();
    expect(s.finance.employment).toBe("employed");
    expect(s.finance.career).toBe("services");
  });

  it("курсы списывают цену и повышают образование", () => {
    const { s, mort, family } = newState("plan-courses");
    s.age = 18;
    s.finance.cash = 100_000;
    const education = s.scales.education;
    expect(startPlan(s, "courses")).toBe(true);
    expect(s.finance.lastBreakdown.property).toBeLessThan(0);
    advanceYear(s, mort, family, names);
    expect(s.scales.education).toBe(education + 8);
    expect(s.focus.careerPoints).toBeGreaterThan(0);
  });

  it("работа мечты выбирается игроком", () => {
    const { s, mort, family } = newState("plan-dream");
    s.age = 18;
    s.finance.cash = 100_000;
    expect(startPlan(s, "dream", "medicine")).toBe(true);
    advanceYear(s, mort, family, names);
    expect(s.finance.career).toBe("medicine");
    expect(s.finance.careerLevel).toBe(1);
  });

  it("лётная школа занимает два года и открывает пилота", () => {
    const { s, mort, family } = newState("plan-pilot");
    s.age = 18;
    s.finance.cash = 100_000;
    s.scales.education = 40;
    expect(startPlan(s, "flightSchool")).toBe(true);
    advanceYear(s, mort, family, names);
    expect(s.plan?.remainingYears).toBe(1);
    expect(s.finance.career).not.toBe("pilot");
    advanceYear(s, mort, family, names);
    expect(s.plan).toBeNull();
    expect(s.finance.career).toBe("pilot");
  });

  it("лётная школа недоступна без образования и денег", () => {
    const { s } = newState("plan-pilot-blocked");
    s.age = 18;
    s.scales.education = 39;
    expect(startPlan(s, "flightSchool")).toBe(false);
    s.scales.education = 40;
    s.finance.cash = 0;
    expect(startPlan(s, "flightSchool")).toBe(false);
  });
});
