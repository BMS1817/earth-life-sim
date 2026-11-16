import type { LifeState, Scales } from "./state.ts";
import type { CareerId } from "./finance.ts";

export type Sector = "tradition" | "change" | "bonds" | "self";
export type PersonSelector = "mother" | "father" | "anyParent" | "olderParent" | "sibling" | "partner" | "child" | "youngChild" | "schoolChild" | "teenChild" | "adultChild" | "friend" | "closest";
export type PersonAction = "addPartner" | "marry" | "haveChild" | "addFriend" | "endPartner" | "estrange" | "reconcile" | "evacuateTogether" | "evacuateAlone" | "protectPeople" | "combat" | "civilianAid" | "unemploy" | "promote" | "work" | "rent" | "parents" | "owned" | "mortgage";

export interface Risk {
  chance: number;
  successText: string;
  successEffects: Partial<Scales>;
  failText: string;
  failEffects: Partial<Scales>;
  successAction?: PersonAction;
  failAction?: PersonAction;
}

export interface Choice {
  sector: Sector;
  label: string;
  outcome: string;
  effects?: Partial<Scales>;
  mortality?: { mult: number; untilAge: number | null };
  risk?: Risk;
  target?: PersonSelector;
  action?: PersonAction;
  career?: CareerId;
}

export interface LifeEvent {
  id: string;
  minAge: number;
  maxAge: number;
  milestone?: boolean;
  crisis?: boolean;
  heavy?: boolean;
  once?: boolean;
  family?: boolean;
  conflict?: boolean;
  subject?: PersonSelector;
  condition?: (s: LifeState) => boolean;
  weight: number | ((s: LifeState) => number);
  text: string;
  choices: Choice[];
}

export function weightOf(e: LifeEvent, s: LifeState): number {
  return typeof e.weight === "function" ? e.weight(s) : e.weight;
}
