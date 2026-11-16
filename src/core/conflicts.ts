import { rngFromSeed } from "./rng.ts";

export type ConflictSource = "organized" | "early-model" | "nonstate" | "scenario";
export type ConflictPhase = "start" | "escalation" | "deescalation" | "end" | "ongoing" | "peace";
export type WarRiskLevel = "low" | "noticeable" | "high";

export interface ConflictYear {
  year: number;
  civilians: number;
  parties: number;
  population: number;
  source: ConflictSource;
}

export interface ConflictData {
  code: number;
  population: number[];
  years: ConflictYear[];
}

export interface WarState {
  seen: { year: number; phase: ConflictPhase }[];
  displacedUntil: number | null;
  peopleDisplaced: boolean;
  heroRisk: number;
  heroCombat: boolean;
  peopleRisk: Record<string, number>;
  pendingEventId: string | null;
}

export function emptyWarState(): WarState {
  return { seen: [], displacedUntil: null, peopleDisplaced: false, heroRisk: 1, heroCombat: false, peopleRisk: {}, pendingEventId: null };
}

export function conflictForYear(data: ConflictData, seed: string, year: number): ConflictYear | null {
  if (year <= 2025) return data.years.find((row) => row.year === year) ?? null;
  const recent = data.years.filter((row) => row.year >= 2016 && row.year <= 2025);
  if (recent.length === 0) return null;
  const block = 2026 + Math.floor((year - 2026) / 5) * 5;
  if (rngFromSeed(`${seed}:${block}:organized-violence`)() >= recent.length / 10) return null;
  const population = data.population[Math.min(2100, year) - 1950];
  const civilianRate = recent.reduce((sum, row) => sum + row.civilians / row.population, 0) / recent.length;
  const partyRate = recent.reduce((sum, row) => sum + row.parties / row.population, 0) / recent.length;
  return {
    year,
    civilians: Math.round(civilianRate * population),
    parties: Math.round(partyRate * population),
    population,
    source: "scenario",
  };
}

export function conflictPhase(data: ConflictData, seed: string, year: number): ConflictPhase {
  const current = conflictForYear(data, seed, year);
  const previous = year > 1950 ? conflictForYear(data, seed, year - 1) : null;
  if (current && !previous) return "start";
  if (!current && previous) return "end";
  if (!current || !previous) return "peace";
  const currentRate = (current.civilians + current.parties) / current.population;
  const previousRate = (previous.civilians + previous.parties) / previous.population;
  if (currentRate > previousRate * 2 && currentRate > previousRate) return "escalation";
  if (currentRate < previousRate / 2) return "deescalation";
  return "ongoing";
}

export function conflictHazard(row: ConflictYear): { civilian: number; parties: number } {
  return {
    civilian: row.population > 0 ? row.civilians / row.population : 0,
    parties: row.population > 0 ? row.parties / row.population : 0,
  };
}

export function riskLevel(civilianHazard: number, baseMortality: number): WarRiskLevel {
  if (baseMortality > 0 && civilianHazard >= baseMortality) return "high";
  if (baseMortality > 0 && civilianHazard >= baseMortality * 0.1) return "noticeable";
  return "low";
}


export function displacementSafeYear(data: ConflictData, seed: string, currentYear: number): number {
  for (let year = currentYear; year <= 2100; year++) {
    if (!conflictForYear(data, seed, year)) return year;
  }
  return 2100;
}
