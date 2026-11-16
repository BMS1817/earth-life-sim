import { MAX_FAVORITE_MOMENTS } from "../content/memorial.ts";
import { createPoliticsState } from "./politics.ts";
import type { LifeState } from "./state.ts";
import type { Birth } from "./types.ts";

const KEY = "earth:life:v8";
const V7_KEY = "earth:life:v7";
const V6_KEY = "earth:life:v6";
const V5_KEY = "earth:life:v5";
const OLD_KEYS = ["earth:life:v4", "earth:life:v3", "earth:life:v2", "earth:life:v1"];

export interface LoadLifeResult {
  state: LifeState | null;
  legacyDiscarded: boolean;
}

export function saveLife(s: LifeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // переполненное хранилище не должно ронять игру
  }
}

function migrateV7(state: LifeState): LifeState {
  state.version = 8;
  state.politics ??= createPoliticsState(undefined, state.birth.year + state.age);
  state.finance.lastBreakdown.politics ??= 0;
  return state;
}

function migrateV6(state: LifeState): LifeState {
  state.focusTotals ??= {};
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

function valid(state: LifeState): boolean {
  return Boolean(
    state.version === 8 &&
    Array.isArray(state.people) &&
    state.war &&
    state.finance &&
    state.time &&
    state.focus &&
    state.focusTotals &&
    Array.isArray(state.hobbies) &&
    Array.isArray(state.pets) &&
    state.lifestyle &&
    state.property &&
    state.politics &&
    state.politics.career &&
    state.politics.constitution &&
    state.politics.alternative &&
    Array.isArray(state.politics.alternative.pending) &&
    Array.isArray(state.politics.alternative.changes) &&
    Array.isArray(state.chronicle) &&
    Array.isArray(state.favoriteMomentIndexes) &&
    Array.isArray(state.happinessHistory) &&
    state.happinessHistory.length > 0 &&
    Number.isFinite(state.happiness)
  );
}

export function loadLife(_gdpForBirth?: (birth: Birth, age: number) => number): LoadLifeResult {
  try {
    let legacyDiscarded = false;
    for (const key of OLD_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        legacyDiscarded = true;
      }
    }
    for (const key of [KEY, V7_KEY, V6_KEY, V5_KEY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as LifeState;
      const state = key === V5_KEY ? migrateV5(parsed) : key === V6_KEY ? migrateV6(parsed) : key === V7_KEY ? migrateV7(parsed) : parsed;
      if (valid(state)) {
        if (key !== KEY) {
          localStorage.removeItem(key);
          saveLife(state);
        }
        return { state, legacyDiscarded };
      }
      localStorage.removeItem(key);
      return { state: null, legacyDiscarded: true };
    }
    return { state: null, legacyDiscarded };
  } catch {
    return { state: null, legacyDiscarded: false };
  }
}

export function clearLife(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(V7_KEY);
    localStorage.removeItem(V6_KEY);
    localStorage.removeItem(V5_KEY);
    for (const key of OLD_KEYS) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
