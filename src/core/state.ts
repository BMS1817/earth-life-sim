import type { Birth } from "./types.ts";
import type { Person, PeopleNews } from "./people.ts";
import type { WarState } from "./conflicts.ts";
import type { CareerId, FinanceState } from "./finance.ts";
import type { PoliticsState } from "./politics.ts";

export interface Scales {
  health: number;
  money: number;
  education: number;
  bonds: number;
}

export type FocusId = "balance" | "study" | "relationships" | "health" | "hobby" | "work" | "growth" | "rest";
export type HobbyId = "games" | "sports" | "reading" | "music" | "crafts" | "nature";

export interface FocusState {
  current: FocusId;
  fractions: Partial<Record<FocusId, number>>;
  careerPoints: number;
}

export interface HobbyState {
  id: HobbyId;
  xp: number;
  level: number;
}

export interface TimeState {
  tick: number;
  speed: number;
  auto: boolean;
}

export type PlanKind = "jobSearch" | "courses" | "dream" | "flightSchool" | "localPolitics";
export type PetKind = "dog" | "cat" | "small";
export type PropertyItemId = "computer" | "bicycle" | "car" | "home";
export type BusinessKind = "shop" | "cafe" | "workshop";

export interface PlanState {
  kind: PlanKind;
  remainingYears: number;
  dreamCareer: CareerId | null;
}

export interface PetState {
  id: string;
  kind: PetKind;
  name: string;
  adoptedYear: number;
  deathYear: number | null;
  lifespan: number;
}

export interface LifestyleState {
  autoGifts: boolean;
  autoCourses: boolean;
  autoHealth: boolean;
  autoTravel: boolean;
  autoHobbyLessons: boolean;
  insurance: boolean;
  nutrition: "normal" | "healthy" | "convenience";
}

export interface BusinessState {
  kind: BusinessKind;
  startedYear: number;
  successfulYears: number;
  level: number;
}

export interface PropertyState {
  items: PropertyItemId[];
  acquired: Partial<Record<PropertyItemId, number>>;
  rentals: number;
  business: BusinessState | null;
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
  source?: "hero" | "people" | "history" | "pattern";
}

export interface HappinessPoint {
  age: number;
  year: number;
  value: number;
}

export interface PendingChoice {
  eventId: string;
  choiceIndex: number;
  outcome: string;
}

export interface LifeState {
  version: 8;
  seed: string;
  birth: Birth;
  age: number;
  scales: Scales;
  happiness: number;
  happinessHistory: HappinessPoint[];
  focus: FocusState;
  focusTotals: Partial<Record<FocusId, number>>;
  favoriteMomentIndexes: number[];
  hobbies: HobbyState[];
  activeHobbyId: HobbyId | null;
  time: TimeState;
  plan: PlanState | null;
  lifestyle: LifestyleState;
  pets: PetState[];
  property: PropertyState;
  compass: Compass;
  modifiers: MortalityModifier[];
  chronicle: ChronicleEntry[];
  alive: boolean;
  deathYear: number | null;
  pendingEventIds: string[];
  pendingFamilyEventId: string | null;
  usedEventIds: string[];
  recentEvents: { id: string; age: number }[];
  lastFamilySceneAge: number | null;
  lastOutcome: string | null;
  lastOutcomeKind: "life" | "family" | "conflict" | null;
  lastFamilyPersonId: string | null;
  lastArrows: Partial<Scales> | null;
  softenHeavy: boolean;
  people: Person[];
  peopleNews: PeopleNews[];
  spouseId: string | null;
  sameSexPartners: boolean;
  patterns: string[];
  war: WarState;
  finance: FinanceState;
  politics: PoliticsState;
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

export function initScales(gdpPerCapita: number): Scales {
  const min = Math.log(300);
  const max = Math.log(100000);
  const money = ((Math.log(Math.max(gdpPerCapita, 300)) - min) / (max - min)) * 100;
  return { health: 80, money: clampScale(money), education: 5, bonds: 60 };
}
