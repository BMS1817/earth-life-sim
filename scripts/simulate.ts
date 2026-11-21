import { readFileSync } from "node:fs";
import { createBirth } from "../src/core/life.ts";
import { rngFromSeed } from "../src/core/rng.ts";
import { applyChoice, createLifeState } from "../src/core/turn.ts";
import { completeYear, hasDecision, pendingEvent, scheduleFollowUpAfterChoice } from "../src/core/flow.ts";
import { bondsSummary } from "../src/core/people.ts";
import { conflictForYear } from "../src/core/conflicts.ts";
import { netWorth } from "../src/core/finance.ts";
import type { ConflictData } from "../src/core/conflicts.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "../src/core/types.ts";
import type { PoliticsData } from "../src/core/politics.ts";
import { attemptUsurpation, canRunForOffice, holdReferendum, startCampaign } from "../src/core/politics.ts";
import { startPlan } from "../src/core/plans.ts";

const N = Number(process.argv[2] ?? 1000);
const WITH_POLITICS = process.argv.includes("--politics");
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
  age: 0,
  choices: 0,
  familyScenes: 0,
  warScenes: 0,
  warDeaths: 0,
  displacements: 0,
  combatChoices: 0,
  people: 0,
  memories: 0,
  saveBytes: 0,
  patterns: 0,
  lonelyEnds: 0,
  repeats: 0,
  children: 0,
  partners: 0,
  friends: 0,
  netWorth: 0,
  wealthGdp: 0,
  debtLives: 0,
  povertyShortfalls: 0,
  politicalTerms: 0,
  referendumAttempts: 0,
  referendumWins: 0,
  usurpationAttempts: 0,
  usurpationWins: 0,
  alternativeLives: 0,
  gdpFactor: 0,
  mortalityFactor: 0,
};
const familyUse = new Map<string, number>();
const careerUse = new Map<string, number>();
const careerChoices = new Map<string, number>();
const careerOffers = new Map<string, number>();
const repeatUse = new Map<string, number>();
const educationAt18: number[] = [];
const samples: object[] = [];
let maxSave = 0;
let maxPeople = 0;
let maxWealthGdp = 0;

for (let i = 0; i < N; i++) {
  const seed = `sim-${i}`;
  const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
  const iso3 = birth.country.iso3;
  const mort = cached(mortCache, iso3, `public/data/mort/${iso3}.json`);
  const family = cached(familyCache, iso3, `public/data/family/${iso3}.json`);
  const conflict = cached(conflictCache, iso3, `public/data/conflicts/${iso3}.json`);
  const politics = cached(politicsCache, iso3, `public/data/politics/${iso3}.json`);
  const gdpTable = income.gdp[iso3] ?? income.gdp._world;
  const state = createLifeState(seed, birth, gdpTable[Math.min(birth.year, 2022) - 1950], family, names, world, politics);
  let guard = 0;
  let familyScenes = 0;
  let warScenes = 0;
  let lastFamilyAge: number | null = null;
  const uses = new Map<string, number>();
  while (state.alive && guard++ < 150) {
    if (WITH_POLITICS && state.age >= 18) {
      if (!state.politics.trainingComplete && state.plan === null) startPlan(state, "localPolitics");
      const career = state.politics.career;
      if (career.status === "none") {
        const level = canRunForOffice(state, "national") ? "national" : canRunForOffice(state, "regional") ? "regional" : "local";
        startCampaign(state, politics, level, (["community", "welfare", "market", "order"] as const)[i % 4]);
      } else if (career.status === "inOffice" && career.level === "national" && !career.amendmentUsed) {
        if (i % 10 === 0) {
          totals.usurpationAttempts++;
          if (attemptUsurpation(state, politics)) totals.usurpationWins++;
        } else {
          totals.referendumAttempts++;
          if (holdReferendum(state, politics, "termYears", state.politics.constitution.termYears === 6 ? 7 : 6)) totals.referendumWins++;
        }
      }
    }
    const termsBefore = state.politics.career.termsServed;
    completeYear(state, mort, family, names, conflict, gdpTable[Math.min(state.birth.year + state.age, 2022) - 1950], politics);
    totals.politicalTerms += Math.max(0, state.politics.career.termsServed - termsBefore);
    let decisionGuard = 0;
    while (state.alive && hasDecision(state)) {
      if (decisionGuard++ > 16) throw new Error(`decision queue did not drain: ${seed}:${state.age}`);
      const event = pendingEvent(state);
      if (!event) throw new Error(`pending event missing: ${seed}:${state.age}`);
      const choice = Math.floor(rngFromSeed(`${seed}:${state.age}:${event.id}:choice`)() * 4);
      if (event.id === "after-school") {
        educationAt18.push(state.scales.education);
        for (const option of event.choices) {
          if (option.career) careerOffers.set(option.career, (careerOffers.get(option.career) ?? 0) + 1);
        }
      }
      applyChoice(state, event, choice, names, conflict);
      const chosenCareer = event.choices[choice].career;
      if (chosenCareer) careerChoices.set(chosenCareer, (careerChoices.get(chosenCareer) ?? 0) + 1);
      const eventUses = (uses.get(event.id) ?? 0) + 1;
      uses.set(event.id, eventUses);
      if (eventUses > 1) repeatUse.set(event.id, (repeatUse.get(event.id) ?? 0) + 1);
      if (event.conflict) {
        warScenes++;
        if (state.war.heroCombat) totals.combatChoices++;
        if (state.war.displacedUntil !== null) totals.displacements++;
      }
      if (event.family) {
        if (lastFamilyAge !== null && state.age - lastFamilyAge < 3) throw new Error(`family interval: ${seed}`);
        lastFamilyAge = state.age;
        familyScenes++;
        familyUse.set(event.id, (familyUse.get(event.id) ?? 0) + 1);
      }
      scheduleFollowUpAfterChoice(state, conflict);
    }
    if (hasDecision(state)) throw new Error(`decision survived year: ${seed}:${state.age}`);
  }
  if (state.alive || guard >= 150) throw new Error(`life did not end: ${seed}`);
  if (new Set(state.people.map((p) => p.id)).size !== state.people.length) throw new Error(`duplicate people: ${seed}`);
  if (state.people.filter((p) => p.role === "child").length > 3) throw new Error(`children limit: ${seed}`);
  if (state.people.filter((p) => p.role === "friend" && p.alive && p.status === "active").length > 2) throw new Error(`friends limit: ${seed}`);
  if (Object.values(state.scales).some((v) => v < 0 || v > 100 || !Number.isFinite(v))) throw new Error(`scales: ${seed}`);
  if (bondsSummary(state.people) < 0 || bondsSummary(state.people) > 100) throw new Error(`bonds: ${seed}`);
  if (state.deathYear !== null && conflictForYear(conflict, seed, state.deathYear)) totals.warDeaths++;
  const saveBytes = JSON.stringify(state).length;
  const memories = state.people.reduce((sum, p) => sum + p.memories.length, 0);
  const repeats = [...uses.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  totals.age += state.age;
  totals.choices += state.compass.choices;
  totals.familyScenes += familyScenes;
  totals.warScenes += warScenes;
  totals.people += state.people.length;
  totals.memories += memories;
  totals.saveBytes += saveBytes;
  totals.patterns += state.patterns.length;
  totals.lonelyEnds += state.scales.bonds === 0 ? 1 : 0;
  totals.repeats += repeats;
  totals.children += state.people.filter((p) => p.role === "child").length;
  totals.partners += state.people.filter((p) => p.role === "partner").length;
  totals.friends += state.people.filter((p) => p.role === "friend").length;
  if (state.politics.alternative.active) totals.alternativeLives++;
  totals.gdpFactor += state.politics.alternative.gdpFactor;
  totals.mortalityFactor += state.politics.alternative.mortalityFactor;
  const wealth = netWorth(state.finance);
  const wealthGdp = wealth / state.finance.gdpPerCapita;
  totals.netWorth += wealth;
  totals.wealthGdp += wealthGdp;
  totals.debtLives += state.finance.cash < 0 ? 1 : 0;
  totals.povertyShortfalls += state.finance.lastExpenseShortfall ? 1 : 0;
  maxWealthGdp = Math.max(maxWealthGdp, wealthGdp);
  const career = state.finance.career ?? "none";
  careerUse.set(career, (careerUse.get(career) ?? 0) + 1);
  maxSave = Math.max(maxSave, saveBytes);
  maxPeople = Math.max(maxPeople, state.people.length);
  if (samples.length < 3) {
    samples.push({
      seed,
      country: iso3,
      birthYear: birth.year,
      deathAge: state.age,
      people: state.people.map((p) => ({ role: p.role, name: p.name, alive: p.alive, memories: p.memories.length })),
      familyScenes,
      warScenes,
      patterns: state.patterns,
    });
  }
}

console.log(JSON.stringify({
  lives: N,
  meanDeathAge: +(totals.age / N).toFixed(2),
  meanChoices: +(totals.choices / N).toFixed(2),
  meanFamilyScenes: +(totals.familyScenes / N).toFixed(2),
  meanWarScenes: +(totals.warScenes / N).toFixed(2),
  deathsInConflictYearShare: +(totals.warDeaths / N).toFixed(3),
  displacements: totals.displacements,
  combatChoices: totals.combatChoices,
  meanNetWorth: Math.round(totals.netWorth / N),
  meanWealthGdpRatio: +(totals.wealthGdp / N).toFixed(2),
  maxWealthGdpRatio: +maxWealthGdp.toFixed(2),
  debtShare: +(totals.debtLives / N).toFixed(3),
  povertyShortfallShare: +(totals.povertyShortfalls / N).toFixed(3),
  careerUse: Object.fromEntries(careerUse),
  careerChoices: Object.fromEntries(careerChoices),
  careerOffers: Object.fromEntries(careerOffers),
  educationAt18: {
    samples: educationAt18.length,
    mean: +(educationAt18.reduce((sum, value) => sum + value, 0) / Math.max(1, educationAt18.length)).toFixed(2),
    medicineEligibleShare: +(educationAt18.filter((value) => value >= 55).length / Math.max(1, educationAt18.length)).toFixed(3),
  },
  mostRepeatedEvents: Object.fromEntries([...repeatUse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)),
  meanPeople: +(totals.people / N).toFixed(2),
  maxPeople,
  meanMemories: +(totals.memories / N).toFixed(2),
  meanSaveBytes: Math.round(totals.saveBytes / N),
  maxSaveBytes: maxSave,
  meanPatterns: +(totals.patterns / N).toFixed(2),
  lonelyEndShare: +(totals.lonelyEnds / N).toFixed(3),
  meanRepeatEvents: +(totals.repeats / N).toFixed(2),
  meanChildren: +(totals.children / N).toFixed(2),
  meanPartners: +(totals.partners / N).toFixed(2),
  meanFriends: +(totals.friends / N).toFixed(2),
  politics: WITH_POLITICS ? {
    terms: totals.politicalTerms,
    referendumAttempts: totals.referendumAttempts,
    referendumWinShare: +(totals.referendumWins / Math.max(1, totals.referendumAttempts)).toFixed(3),
    usurpationAttempts: totals.usurpationAttempts,
    usurpationWinShare: +(totals.usurpationWins / Math.max(1, totals.usurpationAttempts)).toFixed(3),
    alternativeLives: totals.alternativeLives,
    meanGdpFactor: +(totals.gdpFactor / N).toFixed(4),
    meanMortalityFactor: +(totals.mortalityFactor / N).toFixed(4),
  } : undefined,
  familyUse: Object.fromEntries(familyUse),
  samples,
}, null, 2));
