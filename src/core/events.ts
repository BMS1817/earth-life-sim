import type { LifeState, Scales } from "./state.ts";

export type Sector = "tradition" | "change" | "bonds" | "self";

export interface Risk {
  chance: number;
  successText: string;
  successEffects: Partial<Scales>;
  failText: string;
  failEffects: Partial<Scales>;
}

export interface Choice {
  sector: Sector;
  label: string;
  outcome: string;
  effects?: Partial<Scales>;
  mortality?: { mult: number; untilAge: number | null };
  risk?: Risk;
}

export interface LifeEvent {
  id: string;
  minAge: number;
  maxAge: number;
  milestone?: boolean;
  crisis?: boolean;
  heavy?: boolean;
  once?: boolean;
  condition?: (s: LifeState) => boolean;
  weight: number | ((s: LifeState) => number);
  text: string;
  choices: Choice[];
}

export function weightOf(e: LifeEvent, s: LifeState): number {
  return typeof e.weight === "function" ? e.weight(s) : e.weight;
}
