import { createBirth } from "../core/life.ts";
import { rngFromSeed } from "../core/rng.ts";
import { applyChoice, createLifeState } from "../core/turn.ts";
import { completeYear, hasDecision, pendingEvent, scheduleFollowUpAfterChoice } from "../core/flow.ts";
import type { LifeState } from "../core/state.ts";
import type { ConflictData } from "../core/conflicts.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "../core/types.ts";
import type { PoliticsData } from "../core/politics.ts";
import { resourceUrl } from "../ui/resource.ts";

interface IncomeData {
  gdp: Record<string, number[]>;
}

export interface PrototypeLife {
  state: LifeState;
  mort: MortData;
  family: FamilyData;
  conflict: ConflictData;
  politics: PoliticsData;
  names: NamesData;
  worldFamily: FamilyData;
  income: IncomeData;
  ruNames: Record<string, string>;
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(resourceUrl(url));
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

export function gdpForYear(life: PrototypeLife, year: number): number {
  const table = life.income.gdp[life.state.birth.country.iso3] ?? life.income.gdp._world;
  return table[Math.min(year, 2022) - 1950];
}

export function chooseFirst(life: PrototypeLife): void {
  const event = pendingEvent(life.state);
  if (!event) throw new Error("No pending prototype event");
  applyChoice(life.state, event, 0, life.names, life.conflict);
  scheduleFollowUpAfterChoice(life.state, life.conflict);
}

export function advanceYear(life: PrototypeLife): void {
  completeYear(
    life.state,
    life.mort,
    life.family,
    life.names,
    life.conflict,
    gdpForYear(life, life.state.birth.year + life.state.age),
    life.politics,
  );
}

export async function loadPrototypeLife(seed: string): Promise<PrototypeLife> {
  const [index, names, income, ruNames, worldFamily] = await Promise.all([
    loadJson<IndexData>("data/index.json"),
    loadJson<NamesData>("data/names.json"),
    loadJson<IncomeData>("data/income.json"),
    loadJson<Record<string, string>>("data/countries_ru.json"),
    loadJson<FamilyData>("data/family/_world.json"),
  ]);
  const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
  const [mort, family, conflict, politics] = await Promise.all([
    loadJson<MortData>(`data/mort/${birth.country.iso3}.json`),
    loadJson<FamilyData>(`data/family/${birth.country.iso3}.json`),
    loadJson<ConflictData>(`data/conflicts/${birth.country.iso3}.json`),
    loadJson<PoliticsData>(`data/politics/${birth.country.iso3}.json`),
  ]);
  const gdpTable = income.gdp[birth.country.iso3] ?? income.gdp._world;
  const gdp = gdpTable[Math.min(birth.year, 2022) - 1950];
  const state = createLifeState(seed, birth, gdp, family, names, worldFamily, politics);
  return { state, mort, family, conflict, politics, names, worldFamily, income, ruNames };
}

export function playToAdultDecision(life: PrototypeLife, targetAge = 24): void {
  for (let guard = 0; guard < 1000; guard++) {
    if (life.state.age >= targetAge && hasDecision(life.state)) return;
    if (!life.state.alive) throw new Error(`Prototype hero died before age ${targetAge}`);
    if (hasDecision(life.state)) chooseFirst(life);
    else advanceYear(life);
  }
  throw new Error("Prototype adult decision did not converge");
}

export function playToEnd(source: PrototypeLife): LifeState {
  const life = structuredClone(source);
  for (let guard = 0; guard < 2000 && life.state.alive; guard++) {
    if (hasDecision(life.state)) chooseFirst(life);
    else advanceYear(life);
  }
  if (life.state.alive) throw new Error("Prototype memorial did not converge");
  return life.state;
}
