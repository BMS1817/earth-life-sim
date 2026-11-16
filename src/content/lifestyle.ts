import type { PlanKind, PropertyItemId } from "../core/state.ts";

export const PLAN_RULES = {
  jobSearch: { years: 1, cost: 0 },
  courses: { years: 1, cost: 0.5 },
  dream: { years: 1, cost: 0.2 },
  flightSchool: { years: 2, cost: 4 },
  localPolitics: { years: 1, cost: 0 },
} as const;

export const PET_RULES = {
  dog: { minYears: 10, maxYears: 15, annualCost: 0.06, happiness: 1.2, bonds: 0.5 },
  cat: { minYears: 12, maxYears: 18, annualCost: 0.04, happiness: 1, bonds: 0.5 },
  small: { minYears: 2, maxYears: 12, annualCost: 0.02, happiness: 0.6, bonds: 0.25 },
} as const;

export const PROPERTY_RULES: Record<PropertyItemId, { cost: number; happiness: number; annualCost: number }> = {
  computer: { cost: 0.35, happiness: 3, annualCost: 0 },
  bicycle: { cost: 0.05, happiness: 2, annualCost: 0 },
  car: { cost: 2, happiness: 5, annualCost: 0.1 },
  home: { cost: 4, happiness: 10, annualCost: 0 },
};

export const LIFESTYLE_RULES = {
  gifts: { cost: 0.1, interval: 1, happiness: 1, bonds: 2 },
  courses: { cost: 0.5, interval: 2, education: 4, careerPoints: 1 },
  health: { cost: 0.25, interval: 1, health: 2, happiness: 0.5 },
  travel: { cost: 0.4, interval: 1, happiness: 3, bonds: 1, education: 1 },
  hobbyLessons: { cost: 0.2, interval: 1, hobbyXp: 2 },
  healthyFoodCost: 0.1,
  convenienceFoodCost: 0.2,
  insuranceCost: 0.15,
  rentalCost: 3,
  rentalIncome: 0.18,
  rentalMaintenance: 0.06,
  rentalVacancyChance: 0.15,
  businessCost: 2,
  businessProfit: 0.35,
  businessLoss: -0.2,
  businessFailureChance: 0.1,
} as const;

export function planCost(kind: PlanKind, gdp: number): number {
  return PLAN_RULES[kind].cost * gdp;
}

export function propertyCost(id: PropertyItemId, gdp: number): number {
  return PROPERTY_RULES[id].cost * gdp;
}
