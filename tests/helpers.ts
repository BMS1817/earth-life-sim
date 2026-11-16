import { readFileSync } from "node:fs";
import { createBirth } from "../src/core/life.ts";
import { rngFromSeed } from "../src/core/rng.ts";
import { advanceYear, applyChoice, createLifeState, pickFamilyEvent, pickYearEvents } from "../src/core/turn.ts";
import type { LifeState } from "../src/core/state.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "../src/core/types.ts";
import type { PoliticsData } from "../src/core/politics.ts";
import { EVENTS } from "../src/content/events.ts";
import { FAMILY_EVENTS } from "../src/content/family-events.ts";

export const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
export const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));
export const income = JSON.parse(readFileSync("public/data/income.json", "utf-8"));
export const worldFamily: FamilyData = JSON.parse(readFileSync("public/data/family/_world.json", "utf-8"));

export function loadFamily(iso3: string): FamilyData {
  return JSON.parse(readFileSync(`public/data/family/${iso3}.json`, "utf-8"));
}

export function newState(seed: string): { s: LifeState; mort: MortData; family: FamilyData; politics: PoliticsData } {
  const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
  const mort: MortData = JSON.parse(readFileSync(`public/data/mort/${birth.country.iso3}.json`, "utf-8"));
  const family = loadFamily(birth.country.iso3);
  const gdpTable = income.gdp[birth.country.iso3] ?? income.gdp._world;
  const gdp = gdpTable[Math.min(birth.year, 2022) - 1950];
  const politics = JSON.parse(readFileSync(`public/data/politics/${birth.country.iso3}.json`, "utf-8"));
  return { s: createLifeState(seed, birth, gdp, family, names, worldFamily, politics), mort, family, politics };
}

export function autoPlay(seed: string): LifeState {
  const { s, mort, family } = newState(seed);
  let guard = 0;
  while (s.alive && guard++ < 200) {
    const events = pickYearEvents(s, EVENTS);
    if (events.length > 0) applyChoice(s, events[0], 0, names);
    const familyEvent = pickFamilyEvent(s, FAMILY_EVENTS);
    if (familyEvent) applyChoice(s, familyEvent, 0, names);
    advanceYear(s, mort, family, names);
  }
  return s;
}
