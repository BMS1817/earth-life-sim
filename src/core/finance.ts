import { CAREERS, FINANCE_RULES } from "../content/finance.ts";
import { remember, relationshipOf } from "./people.ts";
import { rngFromSeed } from "./rng.ts";
import type { LifeState } from "./state.ts";

export type CareerId = "medicine" | "education" | "engineering" | "industry" | "agriculture" | "services" | "pilot";
export type EmploymentStatus = "school" | "employed" | "unemployed" | "retired";
export type HousingStatus = "parents" | "rent" | "owned" | "mortgage";
export type InvestmentKind = "bonds" | "risky";
export type YearBreakdownKind = "income" | "expenses" | "interest" | "lifestyle" | "rentals" | "business" | "property" | "politics";

export interface FinanceState {
  cash: number;
  bonds: number;
  risky: number;
  gdpPerCapita: number;
  education: number;
  career: CareerId | null;
  careerLevel: number;
  careerStartYear: number | null;
  employment: EmploymentStatus;
  unemployedUntil: number | null;
  housing: HousingStatus;
  mortgageYearsLeft: number;
  lastInvestmentYear: number | null;
  lastYearNet: number;
  lastBreakdown: Record<YearBreakdownKind, number>;
  lastRiskyReturn: number | null;
  lastExpenseShortfall: boolean;
}

export function createFinance(gdpPerCapita: number): FinanceState {
  return {
    cash: 0,
    bonds: 0,
    risky: 0,
    gdpPerCapita,
    education: 5,
    career: null,
    careerLevel: 1,
    careerStartYear: null,
    employment: "school",
    unemployedUntil: null,
    housing: "parents",
    mortgageYearsLeft: 0,
    lastInvestmentYear: null,
    lastYearNet: 0,
    lastBreakdown: { income: 0, expenses: 0, interest: 0, lifestyle: 0, rentals: 0, business: 0, property: 0, politics: 0 },
    lastRiskyReturn: null,
    lastExpenseShortfall: false,
  };
}

export function migrateFinance(scalesMoney: number, age: number, education: number, gdp: number, birthYear: number): FinanceState {
  const career = education >= 55 ? "engineering" : "industry";
  return {
    ...createFinance(gdp),
    education,
    cash: Math.max(0, scalesMoney / 100) * gdp * FINANCE_RULES.migrationSavings,
    career,
    careerStartYear: age >= 18 ? birthYear + 18 : null,
    employment: age >= 65 ? "retired" : age >= 18 ? "employed" : "school",
    housing: age >= 18 ? "rent" : "parents",
  };
}

export function netWorth(f: FinanceState): number {
  return f.cash + f.bonds + f.risky;
}

export function moneyScale(f: FinanceState): number {
  const relative = Math.max(0.01, (netWorth(f) + f.gdpPerCapita) / f.gdpPerCapita);
  return Math.min(100, Math.max(0, 50 + Math.log10(relative) * 40));
}

export function incomeForYear(f: FinanceState, year: number): number {
  if (!f.career || (f.employment !== "employed" && f.employment !== "retired")) return 0;
  const profile = CAREERS[f.career];
  const experience = Math.min(35, Math.max(0, year - (f.careerStartYear ?? year)));
  const experienceFactor = 1 + experience * 0.01;
  const levelFactor = 1 + (f.careerLevel - 1) * 0.1;
  const qualification = profile.minEducation > 0 ? 0.5 + 0.5 * Math.min(1, f.education / profile.minEducation) : 1;
  if (f.employment === "retired") {
    return f.gdpPerCapita * profile.pension * (0.5 + experience / 70) * (1 - FINANCE_RULES.pensionTaxRate);
  }
  return f.gdpPerCapita * profile.income * experienceFactor * levelFactor * qualification * (1 - FINANCE_RULES.taxRate);
}

export function expensesForYear(f: FinanceState, age: number, children: number, partner: boolean): number {
  if (age < 18) return 0;
  const housing = f.housing === "parents" ? FINANCE_RULES.parentHousingCost : f.housing === "rent" ? FINANCE_RULES.rentHousingCost : f.housing === "owned" ? FINANCE_RULES.ownedHousingCost : FINANCE_RULES.mortgageHousingCost;
  return f.gdpPerCapita * (FINANCE_RULES.livingCost + housing + children * FINANCE_RULES.childCost + (partner ? FINANCE_RULES.partnerCost : 0));
}

function debtCap(f: FinanceState, year: number): number {
  return incomeForYear(f, year);
}

function liquidate(f: FinanceState): void {
  if (f.cash >= 0) return;
  const fromBonds = Math.min(f.bonds, -f.cash);
  f.bonds -= fromBonds;
  f.cash += fromBonds;
  if (f.cash < 0) {
    const fromRisky = Math.min(f.risky, -f.cash);
    f.risky -= fromRisky;
    f.cash += fromRisky;
  }
}

function enforceDebt(f: FinanceState, year: number): boolean {
  liquidate(f);
  const cap = debtCap(f, year);
  if (f.cash >= -cap) return false;
  f.cash = -cap;
  return true;
}

export function applyMoneyEvent(f: FinanceState, points: number, year: number): void {
  f.cash += points * f.gdpPerCapita * FINANCE_RULES.eventMoneyPerPoint;
  enforceDebt(f, year);
}

export function invest(f: FinanceState, kind: InvestmentKind, amount: number, year: number): boolean {
  if (f.lastInvestmentYear === year || amount <= 0 || f.cash < amount) return false;
  f.cash -= amount;
  f[kind] += amount;
  f.lastInvestmentYear = year;
  return true;
}

export function divest(f: FinanceState, kind: InvestmentKind, amount: number, year: number): boolean {
  if (f.lastInvestmentYear === year || amount <= 0 || f[kind] < amount) return false;
  f[kind] -= amount;
  f.cash += amount;
  f.lastInvestmentYear = year;
  return true;
}

export function adjustFinanceYear(s: LifeState, kind: YearBreakdownKind, amount: number): void {
  s.finance.cash += amount;
  s.finance.lastYearNet += amount;
  s.finance.lastBreakdown[kind] += amount;
  s.scales.money = moneyScale(s.finance);
}

export function processFinanceYear(s: LifeState, year: number): void {
  const f = s.finance;
  f.education = s.scales.education;
  if (s.age >= 65 && f.career) f.employment = "retired";
  if (f.employment === "unemployed" && f.unemployedUntil !== null && year >= f.unemployedUntil) {
    f.employment = "employed";
    f.unemployedUntil = null;
  }
  const income = incomeForYear(f, year);
  f.bonds *= 1 + FINANCE_RULES.bondReturn;
  f.lastRiskyReturn = f.risky > 0 ? (rngFromSeed(`${s.seed}:${year}:risky-return`)() * 2 - 1) * FINANCE_RULES.riskySpread : 0;
  f.risky = Math.max(0, f.risky * (1 + (f.lastRiskyReturn ?? 0)));
  const children = s.people.filter((p) => p.role === "child" && p.alive && year - p.birthYear < 18).length;
  const partner = s.people.some((p) => p.role === "partner" && p.alive && p.status === "active");
  const expenses = expensesForYear(f, s.age, children, partner);
  const interest = f.cash < 0 ? -f.cash * FINANCE_RULES.debtInterest : 0;
  f.cash += income - expenses - interest;
  if (f.housing === "mortgage") {
    f.mortgageYearsLeft = Math.max(0, f.mortgageYearsLeft - 1);
    if (f.mortgageYearsLeft === 0) f.housing = "owned";
  }
  f.lastYearNet = income - expenses - interest;
  f.lastBreakdown = { income, expenses: -expenses, interest: -interest, lifestyle: 0, rentals: 0, business: 0, property: 0, politics: 0 };
  f.lastExpenseShortfall = enforceDebt(f, year);
  if (f.lastExpenseShortfall) {
    s.scales.health = Math.max(0, s.scales.health - 1);
    const closest = [...s.people].filter((p) => p.alive && p.status === "active").sort((a, b) => relationshipOf(b) - relationshipOf(a))[0];
    if (closest) remember(closest, s.age, year, "poverty", "Деньги закончились. Пришлось жить на минимуме и просить помощи.", -1, "conflict");
  }
  s.scales.money = moneyScale(f);
}
