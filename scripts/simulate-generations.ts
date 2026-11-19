import { readFileSync } from "node:fs";
import { createBirth } from "../src/core/life.ts";
import { rngFromSeed } from "../src/core/rng.ts";
import { advanceYear, applyChoice, createLifeState, pickConflictEvent, pickFamilyEvent, pickYearEvents } from "../src/core/turn.ts";
import { eligibleHeirs, inheritLife } from "../src/core/inheritance.ts";
import { buyRental, startBusiness } from "../src/core/lifestyle.ts";
import { netWorth } from "../src/core/finance.ts";
import type { ConflictData } from "../src/core/conflicts.ts";
import type { PoliticsData } from "../src/core/politics.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "../src/core/types.ts";
import { EVENTS } from "../src/content/events.ts";
import { FAMILY_EVENTS } from "../src/content/family-events.ts";

const N = Number(process.argv[2] ?? 1000);
const GENERATIONS = Number(process.argv[3] ?? 3);
const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const names: NamesData = JSON.parse(readFileSync("public/data/names.json", "utf-8"));
const income = JSON.parse(readFileSync("public/data/income.json", "utf-8"));
const world: FamilyData = JSON.parse(readFileSync("public/data/family/_world.json", "utf-8"));
const mortCache = new Map<string, MortData>();
const familyCache = new Map<string, FamilyData>();
const conflictCache = new Map<string, ConflictData>();
const politicsCache = new Map<string, PoliticsData>();

function cached<T>(cache: Map<string, T>, key: string, path: string): T {
  const existing = cache.get(key);
  if (existing !== undefined) return existing;
  const value = JSON.parse(readFileSync(path, "utf-8")) as T;
  cache.set(key, value);
  return value;
}

const totals = {
  lives: 0,
  completedGenerations: 0,
  age: 0,
  netWorth: 0,
  maxNetWorth: 0,
  debtLives: 0,
  saveBytes: 0,
  maxSaveBytes: 0,
  inheritances: 0,
  inheritedCash: 0,
  insurance: 0,
  rentals: 0,
  businesses: 0,
  gdpFactor: 0,
  mortalityFactor: 0,
};

for (let i = 0; i < N; i++) {
  const seed = `generation-sim-${i}`;
  const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
  const iso3 = birth.country.iso3;
  const mort = cached(mortCache, iso3, `public/data/mort/${iso3}.json`);
  const family = cached(familyCache, iso3, `public/data/family/${iso3}.json`);
  const conflict = cached(conflictCache, iso3, `public/data/conflicts/${iso3}.json`);
  const politics = cached(politicsCache, iso3, `public/data/politics/${iso3}.json`);
  const gdpTable = income.gdp[iso3] ?? income.gdp._world;
  let state = createLifeState(seed, birth, gdpTable[Math.min(birth.year, 2022) - 1950], family, names, world, politics);

  for (let generation = 1; generation <= GENERATIONS; generation++) {
    let guard = 0;
    while (state.alive && guard++ < 150) {
      if (state.age >= 18) {
        if (i % 2 === 0) state.lifestyle.insurance = true;
        if (i % 3 === 0 && state.property.rentals < 3) buyRental(state);
        if (i % 3 === 1 && state.property.business === null) startBusiness(state, "shop");
      }
      const events = pickYearEvents(state, EVENTS);
      if (events.length > 0) applyChoice(state, events[0], i % 4, names, conflict);
      const conflictEvent = pickConflictEvent(state, conflict);
      if (conflictEvent) applyChoice(state, conflictEvent, i % 4, names, conflict);
      const familyEvent = pickFamilyEvent(state, FAMILY_EVENTS);
      if (familyEvent) applyChoice(state, familyEvent, i % 4, names, conflict);
      advanceYear(state, mort, family, names, conflict, gdpTable[Math.min(state.birth.year + state.age, 2022) - 1950], politics);
    }
    if (state.alive || guard >= 150) throw new Error(`Жизнь не завершилась: ${seed}, поколение ${generation}`);
    if (state.lineage.generation !== generation) throw new Error(`Поколение не совпадает: ${seed}`);
    const wealth = netWorth(state.finance);
    const saveBytes = JSON.stringify(state).length;
    totals.lives++;
    totals.completedGenerations = Math.max(totals.completedGenerations, generation);
    totals.age += state.age;
    totals.netWorth += wealth;
    totals.maxNetWorth = Math.max(totals.maxNetWorth, wealth);
    totals.debtLives += state.finance.cash < 0 ? 1 : 0;
    totals.saveBytes += saveBytes;
    totals.maxSaveBytes = Math.max(totals.maxSaveBytes, saveBytes);
    totals.gdpFactor += state.politics.alternative.gdpFactor;
    totals.mortalityFactor += state.politics.alternative.mortalityFactor;
    if (generation === GENERATIONS) break;
    const heirs = eligibleHeirs(state);
    if (heirs.length === 0) break;
    const result = inheritLife(state, heirs[i % heirs.length].id, family, names, world, politics);
    if (!result) throw new Error(`Наследие не удалось: ${seed}, поколение ${generation}`);
    totals.inheritances++;
    totals.inheritedCash += result.state.finance.cash;
    totals.insurance += result.report.insurance;
    totals.rentals += result.report.rentals;
    totals.businesses += result.report.business ? 1 : 0;
    state = result.state;
  }
}

console.log(JSON.stringify({
  series: N,
  requestedGenerations: GENERATIONS,
  lives: totals.lives,
  inheritances: totals.inheritances,
  meanDeathAge: +(totals.age / totals.lives).toFixed(2),
  meanNetWorth: Math.round(totals.netWorth / totals.lives),
  maxNetWorth: Math.round(totals.maxNetWorth),
  debtShare: +(totals.debtLives / totals.lives).toFixed(3),
  meanSaveBytes: Math.round(totals.saveBytes / totals.lives),
  maxSaveBytes: totals.maxSaveBytes,
  meanInheritedCash: Math.round(totals.inheritedCash / Math.max(1, totals.inheritances)),
  meanInsurancePayout: Math.round(totals.insurance / Math.max(1, totals.inheritances)),
  meanInheritedRentals: +(totals.rentals / Math.max(1, totals.inheritances)).toFixed(2),
  inheritedBusinessShare: +(totals.businesses / Math.max(1, totals.inheritances)).toFixed(3),
  meanGdpFactor: +(totals.gdpFactor / totals.lives).toFixed(4),
  meanMortalityFactor: +(totals.mortalityFactor / totals.lives).toFixed(4),
}, null, 2));
