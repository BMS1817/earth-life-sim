import type { Birth } from "./types.ts";

export interface Scales {
  health: number;
  money: number;
  education: number;
  bonds: number;
}

export interface Compass {
  tradition: number;
  bonds: number;
  choices: number;
}

export interface MortalityModifier {
  id: string;
  mult: number;
  untilAge: number | null;
}

export interface ChronicleEntry {
  age: number;
  year: number;
  text: string;
}

export interface PendingChoice {
  eventId: string;
  choiceIndex: number;
  outcome: string;
}

export interface LifeState {
  seed: string;
  birth: Birth;
  age: number;
  scales: Scales;
  compass: Compass;
  modifiers: MortalityModifier[];
  chronicle: ChronicleEntry[];
  alive: boolean;
  deathYear: number | null;
  pendingEventIds: string[];
  usedEventIds: string[];
  recentEvents: { id: string; age: number }[];
  lastOutcome: string | null;
  lastArrows: Partial<Scales> | null;
  softenHeavy: boolean;
}

export const SCALE_MIN = 0;
export const SCALE_MAX = 100;
export const MORTALITY_CAP_MIN = 0.5;
export const MORTALITY_CAP_MAX = 2;

export function clampScale(v: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
}

export function mortalityMultiplier(s: LifeState): number {
  let mult = 1;
  for (const m of s.modifiers) {
    if (m.untilAge === null || s.age < m.untilAge) mult *= m.mult;
  }
  return Math.min(MORTALITY_CAP_MAX, Math.max(MORTALITY_CAP_MIN, mult));
}

export function compassPosition(value: number, choices: number): number {
  return Math.max(-1, Math.min(1, value / Math.max(1, choices)));
}

export function initScales(gdpPerCapita: number): Scales {  const min = Math.log(300);
  const max = Math.log(100000);
  const money = ((Math.log(Math.max(gdpPerCapita, 300)) - min) / (max - min)) * 100;
  return { health: 80, money: clampScale(money), education: 5, bonds: 60 };
}
