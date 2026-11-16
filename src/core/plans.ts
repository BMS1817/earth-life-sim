import type { CareerId } from "./finance.ts";
import type { LifeState, PlanKind } from "./state.ts";
import { clampScale } from "./state.ts";
import { adjustFinanceYear } from "./finance.ts";
import { PLAN_RULES, planCost } from "../content/lifestyle.ts";

export function startPlan(s: LifeState, kind: PlanKind, dreamCareer: CareerId | null = null): boolean {
  if (s.age < 18 || s.plan !== null) return false;
  if (kind === "dream" && dreamCareer === null) return false;
  if (kind === "flightSchool" && s.scales.education < 40) return false;
  const cost = planCost(kind, s.finance.gdpPerCapita);
  if (s.finance.cash < cost) return false;
  if (cost > 0) adjustFinanceYear(s, "property", -cost);
  s.plan = { kind, remainingYears: PLAN_RULES[kind].years, dreamCareer };
  return true;
}

function finishPlan(s: LifeState): void {
  const plan = s.plan!;
  const year = s.birth.year + s.age;
  if (plan.kind === "jobSearch") {
    s.finance.career ??= "services";
    s.finance.careerStartYear ??= year;
    s.finance.careerLevel = Math.max(1, s.finance.careerLevel);
    s.finance.employment = "employed";
    s.finance.unemployedUntil = null;
  } else if (plan.kind === "courses") {
    s.scales.education = clampScale(s.scales.education + 8);
    s.focus.careerPoints += 1.5;
  } else if (plan.kind === "dream" && plan.dreamCareer) {
    s.finance.career = plan.dreamCareer;
    s.finance.careerStartYear = year;
    s.finance.careerLevel = 1;
    s.finance.employment = "employed";
    s.finance.unemployedUntil = null;
  } else if (plan.kind === "flightSchool") {
    s.finance.career = "pilot";
    s.finance.careerStartYear = year;
    s.finance.careerLevel = 1;
    s.finance.employment = "employed";
    s.finance.unemployedUntil = null;
  } else if (plan.kind === "localPolitics") {
    s.politics.trainingComplete = true;
  }
  s.chronicle.push({ age: s.age, year, text: `Завершён годовой план: ${plan.kind}.`, source: "hero" });
  s.plan = null;
}

export function processPlanYear(s: LifeState): void {
  if (!s.plan) return;
  s.plan.remainingYears--;
  if (s.plan.remainingYears <= 0) finishPlan(s);
}
