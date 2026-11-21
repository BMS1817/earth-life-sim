import { readFileSync } from "node:fs";
import { createBirth } from "../src/core/life.ts";
import { rngFromSeed } from "../src/core/rng.ts";
import { applyChoice, createLifeState } from "../src/core/turn.ts";
import { completeYear, hasDecision, pendingEvent, scheduleFollowUpAfterChoice } from "../src/core/flow.ts";
import type { ConflictData } from "../src/core/conflicts.ts";
import type { LifeState } from "../src/core/state.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "../src/core/types.ts";
import type { PoliticsData } from "../src/core/politics.ts";

export const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
export const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));
export const income = JSON.parse(readFileSync("public/data/income.json", "utf-8"));
export const worldFamily: FamilyData = JSON.parse(readFileSync("public/data/family/_world.json", "utf-8"));

export function loadFamily(iso3: string): FamilyData {
  return JSON.parse(readFileSync(`public/data/family/${iso3}.json`, "utf-8"));
}

export function newState(seed: string): { s: LifeState; mort: MortData; family: FamilyData; conflict: ConflictData; politics: PoliticsData } {
  const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
  const mort: MortData = JSON.parse(readFileSync(`public/data/mort/${birth.country.iso3}.json`, "utf-8"));
  const family = loadFamily(birth.country.iso3);
  const conflict: ConflictData = JSON.parse(readFileSync(`public/data/conflicts/${birth.country.iso3}.json`, "utf-8"));
  const gdpTable = income.gdp[birth.country.iso3] ?? income.gdp._world;
  const gdp = gdpTable[Math.min(birth.year, 2022) - 1950];
  const politics = JSON.parse(readFileSync(`public/data/politics/${birth.country.iso3}.json`, "utf-8"));
  return { s: createLifeState(seed, birth, gdp, family, names, worldFamily, politics), mort, family, conflict, politics };
}

export function autoPlay(seed: string): LifeState {
  const { s, mort, family, conflict, politics } = newState(seed);
  const gdpTable = income.gdp[s.birth.country.iso3] ?? income.gdp._world;
  let guard = 0;
  while (s.alive && guard++ < 200) {
    completeYear(s, mort, family, names, conflict, gdpTable[Math.min(s.birth.year + s.age, 2022) - 1950], politics);
    let decisionGuard = 0;
    while (s.alive && hasDecision(s)) {
      if (decisionGuard++ > 16) throw new Error(`Очередь решений не завершилась: ${seed}:${s.age}`);
      const event = pendingEvent(s);
      if (!event) throw new Error(`Ожидающее событие не найдено: ${seed}:${s.age}`);
      applyChoice(s, event, 0, names, conflict);
      scheduleFollowUpAfterChoice(s, conflict);
    }
  }
  return s;
}
