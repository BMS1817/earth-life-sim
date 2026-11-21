import { MAX_FAVORITE_MOMENTS } from "../content/memorial.ts";
import { createLineageState, initialHeroTraits } from "./inheritance.ts";
import { createPoliticsState } from "./politics.ts";
import type { LifeState } from "./state.ts";
import type { Birth } from "./types.ts";
import { validLifeState } from "./save-validation.ts";

const KEY = "earth:life:v10";
const BACKUP_KEY = "earth:life:v10:backup";
const V9_KEY = "earth:life:v9";
const V8_KEY = "earth:life:v8";
const V7_KEY = "earth:life:v7";
const V6_KEY = "earth:life:v6";
const V5_KEY = "earth:life:v5";
const OLD_KEYS = ["earth:life:v4", "earth:life:v3", "earth:life:v2", "earth:life:v1"];

export interface LoadLifeResult {
  state: LifeState | null;
  legacyDiscarded: boolean;
  recoveredBackup: boolean;
  writeFailed: boolean;
}

export type ParseLifeError = "invalid" | "newer" | null;

export function saveLife(s: LifeState): boolean {
  try {
    const previous = localStorage.getItem(KEY);
    if (previous && parseLife(previous)) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

function migrateV9(state: LifeState): LifeState {
  const mapping: Record<string, string> = { study: "education", work: "money", relationships: "bonds", rest: "happiness", growth: "education", health: "balance", hobby: "happiness" };
  state.focus ??= { current: "balance", fractions: {}, careerPoints: 0 };
  state.focus.current = (mapping[state.focus.current] ?? state.focus.current) as LifeState["focus"]["current"];
  state.focusTotals = Object.fromEntries(
    Object.entries(state.focusTotals ?? {}).reduce((totals, [id, value]) => {
      const target = mapping[id] ?? id;
      totals.set(target, (totals.get(target) ?? 0) + value);
      return totals;
    }, new Map<string, number>()),
  ) as LifeState["focusTotals"];
  state.version = 10;
  return state;
}

function migrateV8(state: LifeState): LifeState {
  state.lineage ??= createLineageState(state.seed);
  state.lineage.ancestors ??= [];
  state.lineage.heroTraits ??= initialHeroTraits(state.seed);
  state.lineage.lastInheritance ??= null;
  return migrateV9(state);
}

function migrateV7(state: LifeState): LifeState {
  state.politics ??= createPoliticsState(undefined, state.birth.year + state.age);
  state.finance.lastBreakdown.politics ??= 0;
  return migrateV8(state);
}

function migrateV6(state: LifeState): LifeState {
  state.focusTotals ??= {};
  state.favoriteMomentIndexes = Array.isArray(state.favoriteMomentIndexes)
    ? [...new Set(state.favoriteMomentIndexes)]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < state.chronicle.length)
      .sort((a, b) => a - b)
      .slice(0, MAX_FAVORITE_MOMENTS)
    : [];
  state.happinessHistory = Array.isArray(state.happinessHistory)
    ? state.happinessHistory.filter((point) => point && Number.isFinite(point.age) && Number.isFinite(point.year) && Number.isFinite(point.value))
    : [];
  if (state.happinessHistory.length === 0) {
    state.happinessHistory = [{ age: state.age, year: state.birth.year + state.age, value: state.happiness }];
  }
  return migrateV7(state);
}

function migrateV5(state: LifeState): LifeState {
  state.plan ??= null;
  state.lifestyle ??= { autoGifts: false, autoCourses: false, autoHealth: false, autoTravel: false, autoHobbyLessons: false, insurance: false, nutrition: "normal" };
  state.pets ??= [];
  state.property ??= { items: [], acquired: {}, rentals: 0, business: null };
  state.property.acquired ??= {};
  state.finance.lastBreakdown ??= { income: 0, expenses: 0, interest: 0, lifestyle: 0, rentals: 0, business: 0, property: 0, politics: 0 };
  return migrateV6(state);
}

function decodeLife(raw: string): { state: LifeState | null; error: ParseLifeError } {
  const parsed = JSON.parse(raw) as LifeState;
  const version = (parsed as { version: number }).version;
  if (Number.isInteger(version) && version > 10) return { state: null, error: "newer" };
  if (!Number.isInteger(version) || version < 5) return { state: null, error: "invalid" };
  const state = version === 5 ? migrateV5(parsed) : version === 6 ? migrateV6(parsed) : version === 7 ? migrateV7(parsed) : version === 8 ? migrateV8(parsed) : version === 9 ? migrateV9(parsed) : parsed;
  const isValid = validLifeState(state);
  return { state: isValid ? state : null, error: isValid ? null : "invalid" };
}

export function serializeLife(state: LifeState): string {
  return JSON.stringify(state);
}

export function parseLifeDetailed(raw: string): { state: LifeState | null; error: ParseLifeError } {
  try {
    return decodeLife(raw);
  } catch {
    return { state: null, error: "invalid" };
  }
}

export function parseLife(raw: string): LifeState | null {
  return parseLifeDetailed(raw).state;
}

export function loadLife(_gdpForBirth?: (birth: Birth, age: number) => number): LoadLifeResult {
  let writeFailed = false;
  try {
    let legacyDiscarded = false;
    for (const key of OLD_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        legacyDiscarded = true;
      }
    }
    for (const key of [KEY, BACKUP_KEY, V9_KEY, V8_KEY, V7_KEY, V6_KEY, V5_KEY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const state = parseLifeDetailed(raw).state;
      if (!state) {
        if (key !== KEY && key !== BACKUP_KEY) localStorage.removeItem(key);
        if (key === KEY || key === BACKUP_KEY) continue;
        return { state: null, legacyDiscarded: true, recoveredBackup: false, writeFailed };
      }
      const recoveredBackup = key === BACKUP_KEY;
      if (key !== KEY) {
        writeFailed = !saveLife(state);
        if (!writeFailed && key !== BACKUP_KEY) localStorage.removeItem(key);
      }
      return { state, legacyDiscarded, recoveredBackup, writeFailed };
    }
    return { state: null, legacyDiscarded, recoveredBackup: false, writeFailed };
  } catch {
    return { state: null, legacyDiscarded: false, recoveredBackup: false, writeFailed: true };
  }
}

export function clearLife(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(V9_KEY);
    localStorage.removeItem(V8_KEY);
    localStorage.removeItem(V7_KEY);
    localStorage.removeItem(V6_KEY);
    localStorage.removeItem(V5_KEY);
    for (const key of OLD_KEYS) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
