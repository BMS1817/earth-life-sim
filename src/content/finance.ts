import type { CareerId } from "../core/finance.ts";

export interface CareerProfile {
  income: number;
  pension: number;
  minEducation: number;
  prop: "book" | "laptop" | "wrench" | "plant" | "case" | "tool" | "cap";
}

export const CAREERS: Record<CareerId, CareerProfile> = {
  medicine: { income: 1.4, pension: 0.55, minEducation: 55, prop: "book" },
  education: { income: 0.85, pension: 0.45, minEducation: 25, prop: "case" },
  engineering: { income: 1.25, pension: 0.5, minEducation: 55, prop: "laptop" },
  industry: { income: 0.8, pension: 0.4, minEducation: 0, prop: "wrench" },
  agriculture: { income: 0.65, pension: 0.35, minEducation: 0, prop: "plant" },
  services: { income: 0.95, pension: 0.4, minEducation: 0, prop: "tool" },
  pilot: { income: 2.2, pension: 0.65, minEducation: 40, prop: "cap" },
};

export const FINANCE_RULES = {
  taxRate: 0.2,
  pensionTaxRate: 0.1,
  livingCost: 0.35,
  partnerCost: 0.04,
  childCost: 0.06,
  parentHousingCost: 0.02,
  rentHousingCost: 0.12,
  ownedHousingCost: 0.04,
  mortgageHousingCost: 0.15,
  debtInterest: 0.03,
  bondReturn: 0.02,
  riskySpread: 0.15,
  eventMoneyPerPoint: 0.02,
  migrationSavings: 0.25,
  mortgageYears: 15,
  unemploymentYears: 2,
  investmentAmount: 100,
} as const;
