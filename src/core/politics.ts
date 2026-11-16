import { PLATFORMS, POLITICS_LEVEL_TEXT, POLITICS_PLATFORM_TEXT, POLITICS_RULES, USURPATION_EFFECTS } from "../content/politics.ts";
import { rngFromSeed } from "./rng.ts";
import { adjustFinanceYear } from "./finance.ts";
import { clampScale } from "./state.ts";
import type { LifeState } from "./state.ts";

export type GovernmentForm = "presidential" | "semiPresidential" | "parliamentary" | "monarchy" | "council";
export type LeaderSelection = "popular" | "legislature" | "appointed" | "hereditary";
export type PoliticalLevel = "local" | "regional" | "national";
export type PoliticalPlatform = "community" | "welfare" | "market" | "order";
export type PoliticalStatus = "none" | "candidate" | "inOffice";
export type AmendmentField = "form" | "leader" | "termYears" | "termLimit" | "legislature" | "judiciary";
export type AmendmentValue = string | number | boolean;

export interface PoliticsData {
  iso3: string;
  source: string;
  license: string;
  years: [number, number];
  fallbackReferences: string[];
  elections: { parliamentary: number[]; presidential: number[] };
  regime: number[];
  polyarchy: number[];
  liberal: number[];
  elected: number[];
  form: number[];
  leader: number[];
  termYears: number[];
  termLimits: number[];
  estimated: number[];
}

export interface ConstitutionState {
  form: GovernmentForm;
  leader: LeaderSelection;
  termYears: number;
  termLimit: number;
  legislature: boolean;
  judiciary: boolean;
}

export interface PoliticalCareer {
  status: PoliticalStatus;
  level: PoliticalLevel | null;
  lastLevel: PoliticalLevel | null;
  platform: PoliticalPlatform;
  support: number;
  experience: Record<PoliticalLevel, number>;
  nextElectionYear: number | null;
  termStartYear: number | null;
  termEndYear: number | null;
  termsServed: number;
  amendmentUsed: boolean;
}

export interface AlternativeChange {
  year: number;
  field: AmendmentField | "usurpation";
  before: AmendmentValue | null;
  after: AmendmentValue | null;
  method: "referendum" | "usurpation";
  success: boolean;
}

export interface PendingAlternativeEffect {
  effectiveYear: number;
  gdp: number;
  mortality: number;
}

export interface PoliticsState {
  trainingComplete: boolean;
  career: PoliticalCareer;
  constitution: ConstitutionState;
  alternative: {
    active: boolean;
    gdpFactor: number;
    mortalityFactor: number;
    pending: PendingAlternativeEffect[];
    changes: AlternativeChange[];
  };
  lastResult: string | null;
}

export interface PoliticsYear {
  year: number;
  regime: number;
  polyarchy: number;
  liberal: number;
  elected: number;
  constitution: ConstitutionState;
  estimated: boolean;
  scenario: boolean;
}

const FORMS: GovernmentForm[] = ["presidential", "semiPresidential", "parliamentary", "monarchy", "council"];
const LEADERS: LeaderSelection[] = ["popular", "legislature", "appointed", "hereditary"];
const DEFAULT_CONSTITUTION: ConstitutionState = { form: "parliamentary", leader: "legislature", termYears: 4, termLimit: 0, legislature: true, judiciary: true };

function indexFor(data: PoliticsData, year: number): number {
  return Math.max(0, Math.min(data.years[1] - data.years[0], Math.max(data.years[0], Math.min(data.years[1], year)) - data.years[0]));
}

export function politicsYear(data: PoliticsData, year: number): PoliticsYear {
  const index = indexFor(data, year);
  return {
    year,
    regime: data.regime[index],
    polyarchy: data.polyarchy[index],
    liberal: data.liberal[index],
    elected: data.elected[index],
    constitution: {
      form: FORMS[data.form[index]] ?? "council",
      leader: LEADERS[data.leader[index]] ?? "appointed",
      termYears: data.termYears[index],
      termLimit: data.termLimits[index],
      legislature: data.elected[index] >= 0.25,
      judiciary: data.liberal[index] >= 0.35,
    },
    estimated: data.estimated[index] === 1,
    scenario: year < data.years[0] || year > data.years[1],
  };
}

export function createPoliticsState(data?: PoliticsData, year = 1950): PoliticsState {
  return {
    trainingComplete: false,
    career: {
      status: "none", level: null, lastLevel: null, platform: "community", support: 0,
      experience: { local: 0, regional: 0, national: 0 }, nextElectionYear: null,
      termStartYear: null, termEndYear: null, termsServed: 0, amendmentUsed: false,
    },
    constitution: data ? politicsYear(data, year).constitution : { ...DEFAULT_CONSTITUTION },
    alternative: { active: false, gdpFactor: 1, mortalityFactor: 1, pending: [], changes: [] },
    lastResult: null,
  };
}

export function syncPoliticsBaseline(s: LifeState, data: PoliticsData, year: number): void {
  if (!s.politics.alternative.active) s.politics.constitution = politicsYear(data, year).constitution;
}

function observedElections(data: PoliticsData, constitution: ConstitutionState): number[] {
  if (constitution.leader === "hereditary") return [];
  return constitution.leader === "popular" && data.elections.presidential.length > 0
    ? data.elections.presidential
    : data.elections.parliamentary;
}

function cycleFromElections(elections: number[], fallback: number): number {
  if (elections.length < 2) return fallback;
  const intervals = elections.slice(-6).slice(1).map((year, index) => year - elections.slice(-6)[index]).filter((value) => value > 0);
  if (intervals.length === 0) return fallback;
  intervals.sort((a, b) => a - b);
  return intervals[Math.floor(intervals.length / 2)];
}

export function nextElectionYear(data: PoliticsData, level: PoliticalLevel, constitution: ConstitutionState, year: number): number | null {
  if (level === "national" && constitution.leader === "hereditary") return null;
  const observed = level === "national" ? observedElections(data, constitution) : [];
  const future = observed.find((election) => election > year);
  if (future !== undefined) return future;
  const cycle = level === "national"
    ? cycleFromElections(observed, constitution.termYears || POLITICS_RULES.syntheticCycle.national)
    : POLITICS_RULES.syntheticCycle[level];
  if (cycle <= 0) return null;
  let next = observed.at(-1) ?? year + cycle;
  while (next <= year) next += cycle;
  return next;
}

export function campaignCost(s: LifeState, level: PoliticalLevel): number {
  return POLITICS_RULES.campaignCost[level] * s.finance.gdpPerCapita;
}

export function canRunForOffice(s: LifeState, level: PoliticalLevel): boolean {
  const career = s.politics.career;
  if (!s.alive || s.age < 18 || career.status !== "none") return false;
  if (level === "local" && !s.politics.trainingComplete) return false;
  if (level === "regional" && career.experience.local < POLITICS_RULES.localExperienceForRegional) return false;
  if (level === "national" && (career.experience.regional < POLITICS_RULES.regionalExperienceForNational || s.scales.education < POLITICS_RULES.nationalEducation)) return false;
  const limit = level === "national" ? s.politics.constitution.termLimit : 0;
  return !(limit > 0 && career.lastLevel === level && career.termsServed >= limit);
}

export function startCampaign(s: LifeState, data: PoliticsData, level: PoliticalLevel, platform: PoliticalPlatform): boolean {
  if (!canRunForOffice(s, level)) return false;
  const year = s.birth.year + s.age;
  const next = nextElectionYear(data, level, s.politics.constitution, year);
  const cost = campaignCost(s, level);
  if (next === null || s.finance.cash < cost) return false;
  adjustFinanceYear(s, "politics", -cost);
  const career = s.politics.career;
  const experience = career.experience.local + career.experience.regional + career.experience.national;
  career.support = Math.round(Math.max(20, Math.min(85, 30 + s.scales.education * 0.15 + s.scales.bonds * 0.1 + experience * 3 + PLATFORMS[platform].support)));
  career.status = "candidate";
  career.level = level;
  career.platform = platform;
  career.nextElectionYear = next;
  career.termStartYear = null;
  career.termEndYear = null;
  career.amendmentUsed = false;
  s.politics.lastResult = `Кампания уровня ${POLITICS_LEVEL_TEXT[level]} начата. Выборы: ${next}.`;
  return true;
}

export function electionChance(s: LifeState, data: PoliticsData): number {
  const career = s.politics.career;
  if (career.status !== "candidate" || !career.level) return 0;
  const profile = politicsYear(data, s.birth.year + s.age);
  const regimeFactor = career.level === "national" ? [0.35, 0.65, 0.9, 1][profile.regime] : 0.8;
  return Math.max(0.05, Math.min(0.85, (0.15 + career.support / 100 * 0.75) * regimeFactor));
}

function finishElection(s: LifeState, data: PoliticsData, year: number): void {
  const career = s.politics.career;
  const level = career.level!;
  const won = rngFromSeed(`${s.seed}:${year}:election:${level}`)() < electionChance(s, data);
  if (!won) {
    s.politics.lastResult = "Выборы проиграны. Можно попробовать снова в следующий цикл.";
    s.chronicle.push({ age: s.age, year, text: `Политическая кампания уровня ${POLITICS_LEVEL_TEXT[level]} завершилась поражением.`, source: "hero" });
    career.status = "none";
    career.level = null;
    career.nextElectionYear = null;
    career.support = 0;
    return;
  }
  if (career.lastLevel !== level) career.termsServed = 0;
  career.termsServed++;
  career.lastLevel = level;
  career.status = "inOffice";
  career.termStartYear = year;
  const next = nextElectionYear(data, level, s.politics.constitution, year);
  career.termEndYear = next ?? year + (s.politics.constitution.termYears || POLITICS_RULES.syntheticCycle[level]);
  career.nextElectionYear = null;
  career.support = 55;
  career.amendmentUsed = false;
  s.happiness = clampScale(s.happiness + PLATFORMS[career.platform].happiness);
  s.scales.bonds = clampScale(s.scales.bonds + PLATFORMS[career.platform].bonds);
  s.politics.lastResult = `Победа на выборах. Срок до ${career.termEndYear} года.`;
  s.chronicle.push({ age: s.age, year, text: `Победа на выборах: политический уровень ${POLITICS_LEVEL_TEXT[level]}, платформа ${POLITICS_PLATFORM_TEXT[career.platform]}.`, source: "hero" });
}

function queueEffect(s: LifeState, year: number, gdp: number, mortality: number): void {
  s.politics.alternative.active = true;
  s.politics.alternative.pending.push({ effectiveYear: year + POLITICS_RULES.effectLagYears, gdp, mortality });
}

function amendmentEffect(field: AmendmentField, before: AmendmentValue, after: AmendmentValue): { gdp: number; mortality: number } {
  if (field === "judiciary") return { gdp: 0, mortality: after === true ? -0.005 : 0.005 };
  if (field === "legislature") return { gdp: 0, mortality: after === true ? -0.005 : 0.005 };
  if (field === "termLimit") return { gdp: 0, mortality: Number(after) < Number(before) ? -0.005 : 0.005 };
  if (field === "termYears") return { gdp: Number(after) > Number(before) ? 0.005 : -0.005, mortality: Number(after) > Number(before) ? 0.005 : -0.005 };
  if (field === "leader") return { gdp: 0, mortality: after === "popular" ? -0.005 : after === "hereditary" ? 0.005 : 0 };
  if (field === "form") return { gdp: after === "monarchy" ? -0.005 : 0.005, mortality: after === "parliamentary" ? -0.005 : 0 };
  return { gdp: 0, mortality: 0 };
}

function validAmendment(field: AmendmentField, value: AmendmentValue): boolean {
  if (field === "form") return FORMS.includes(value as GovernmentForm);
  if (field === "leader") return LEADERS.includes(value as LeaderSelection);
  if (field === "termYears") return [4, 5, 6, 7].includes(Number(value));
  if (field === "termLimit") return [0, 1, 2, 3].includes(Number(value));
  return typeof value === "boolean";
}

export function referendumChance(s: LifeState, data: PoliticsData, field: AmendmentField): number {
  if (s.politics.career.status !== "inOffice" || s.politics.career.level !== "national") return 0;
  const profile = politicsYear(data, s.birth.year + s.age);
  let chance = 0.35 + s.politics.career.support / 200 + profile.polyarchy * 0.15;
  if (s.politics.constitution.legislature) chance += 0.05;
  if (s.politics.constitution.judiciary) chance += 0.05;
  if (field === "form" || field === "leader") chance -= 0.1;
  return Math.max(0.1, Math.min(0.85, chance));
}

export function holdReferendum(s: LifeState, data: PoliticsData, field: AmendmentField, value: AmendmentValue): boolean {
  const career = s.politics.career;
  if (career.status !== "inOffice" || career.level !== "national" || career.amendmentUsed || !validAmendment(field, value)) return false;
  const before = s.politics.constitution[field];
  if (before === value) return false;
  const year = s.birth.year + s.age;
  const won = rngFromSeed(`${s.seed}:${year}:referendum:${field}`)() < referendumChance(s, data, field);
  career.amendmentUsed = true;
  s.politics.alternative.changes.push({ year, field, before, after: value, method: "referendum", success: won });
  if (!won) {
    career.support = Math.max(0, career.support - 5);
    s.happiness = clampScale(s.happiness - 2);
    s.politics.lastResult = "Референдум не поддержал поправку. Новая поправка — только в следующий срок.";
    return false;
  }
  (s.politics.constitution[field] as AmendmentValue) = value;
  const effect = amendmentEffect(field, before, value);
  queueEffect(s, year, effect.gdp, effect.mortality);
  career.support = Math.min(100, career.support + 3);
  s.politics.lastResult = `Поправка принята. Последствия проявятся с ${year + POLITICS_RULES.effectLagYears} года.`;
  s.chronicle.push({ age: s.age, year, text: `Конституционная поправка принята через референдум: ${field}.`, source: "hero" });
  return true;
}

export function usurpationChance(s: LifeState, data: PoliticsData): number {
  if (s.politics.career.status !== "inOffice" || s.politics.career.level !== "national") return 0;
  const profile = politicsYear(data, s.birth.year + s.age);
  let chance = 0.25 + s.politics.career.support / 200 - profile.polyarchy * 0.2;
  if (s.politics.constitution.legislature) chance -= 0.1;
  if (s.politics.constitution.judiciary) chance -= 0.1;
  return Math.max(0.05, Math.min(0.6, chance));
}

export function attemptUsurpation(s: LifeState, data: PoliticsData): boolean {
  const career = s.politics.career;
  if (career.status !== "inOffice" || career.level !== "national" || career.amendmentUsed) return false;
  const year = s.birth.year + s.age;
  const won = rngFromSeed(`${s.seed}:${year}:usurpation`)() < usurpationChance(s, data);
  career.amendmentUsed = true;
  s.politics.alternative.changes.push({ year, field: "usurpation", before: null, after: null, method: "usurpation", success: won });
  if (!won) {
    career.status = "none";
    career.level = null;
    career.support = 0;
    career.termStartYear = null;
    career.termEndYear = null;
    s.happiness = clampScale(s.happiness - 8);
    s.politics.lastResult = "Узурпация провалилась: ветви власти и общество остановили попытку. Полномочия утрачены.";
    s.chronicle.push({ age: s.age, year, text: "Попытка узурпации власти провалилась из-за противодействия.", source: "hero" });
    return false;
  }
  s.politics.constitution = { form: "presidential", leader: "appointed", termYears: 7, termLimit: 0, legislature: false, judiciary: false };
  career.support = Math.max(0, career.support - 10);
  queueEffect(s, year, USURPATION_EFFECTS.gdp, USURPATION_EFFECTS.mortality);
  s.politics.lastResult = "Узурпация удалась: ограничения власти ослаблены. Последствия будут с задержкой.";
  s.chronicle.push({ age: s.age, year, text: "Узурпация власти изменила конституционный порядок.", source: "hero" });
  return true;
}

export function processPoliticsYear(s: LifeState, data: PoliticsData, year: number): void {
  syncPoliticsBaseline(s, data, year);
  const alternative = s.politics.alternative;
  const due = alternative.pending.filter((effect) => effect.effectiveYear <= year);
  alternative.pending = alternative.pending.filter((effect) => effect.effectiveYear > year);
  for (const effect of due) {
    alternative.gdpFactor = Math.max(POLITICS_RULES.minGdpFactor, Math.min(POLITICS_RULES.maxGdpFactor, alternative.gdpFactor + effect.gdp));
    alternative.mortalityFactor = Math.max(POLITICS_RULES.minMortalityFactor, Math.min(POLITICS_RULES.maxMortalityFactor, alternative.mortalityFactor + effect.mortality));
  }
  const career = s.politics.career;
  if (career.status === "candidate" && career.nextElectionYear === year) finishElection(s, data, year);
  else if (career.status === "inOffice") {
    if (career.termStartYear !== null && year > career.termStartYear && career.level) career.experience[career.level]++;
    if (career.termEndYear !== null && year >= career.termEndYear) {
      s.politics.lastResult = "Срок полномочий завершён. Можно начать новую кампанию.";
      career.status = "none";
      career.level = null;
      career.termStartYear = null;
      career.termEndYear = null;
      career.amendmentUsed = false;
    }
  }
}

export function alternativeGdp(s: LifeState, base: number): number {
  return base * s.politics.alternative.gdpFactor;
}

export function alternativeMortality(s: LifeState): number {
  return s.politics.alternative.mortalityFactor;
}
