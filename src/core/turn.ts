import { rngFromSeed, weightedIndex } from "./rng.ts";
import type { Rng } from "./rng.ts";
import { weightOf } from "./events.ts";
import type { Choice, LifeEvent, PersonAction, PersonSelector, Sector } from "./events.ts";
import { clampScale, initScales, mortalityMultiplier } from "./state.ts";
import type { LifeState, Scales } from "./state.ts";
import type { Birth, FamilyData, MortData, NamesData } from "./types.ts";
import { HISTORY } from "../content/history.ts";
import { detectPatterns } from "../content/patterns.ts";
import { advancePeople, bondsSummary, createFamily, createPerson, remember, relationshipOf } from "./people.ts";
import type { Person } from "./people.ts";
import { pickSex } from "./birth.ts";
import { conflictForYear, conflictHazard, conflictPhase, displacementSafeYear, emptyWarState } from "./conflicts.ts";
import type { ConflictData } from "./conflicts.ts";
import { conflictEventForPhase } from "../content/conflict-events.ts";
import { applyMoneyEvent, createFinance, moneyScale, processFinanceYear } from "./finance.ts";
import { FINANCE_RULES } from "../content/finance.ts";
import { careerEvent } from "../content/career-events.ts";
import { completeFocusYear } from "./focus.ts";
import { processPlanYear } from "./plans.ts";
import { processLifestyleYear } from "./lifestyle.ts";
import { recordHappiness } from "./memorial.ts";
import { alternativeGdp, alternativeMortality, createPoliticsState, processPoliticsYear } from "./politics.ts";
import type { PoliticsData } from "./politics.ts";
import { createLineageState } from "./inheritance.ts";

export const MILESTONE_AGES = [6, 12, 16, 18];
export const QUIET_YEAR_CHANCE = 0.35;
export const EVENT_COOLDOWN_YEARS = 8;
export const WAR_PHASE_COOLDOWN_YEARS = 5;
export const FAMILY_SCENE_INTERVAL = 3;
export const MAX_CHILDREN = 3;
export const MAX_FRIENDS = 2;

export function createLifeState(
  seed: string,
  birth: Birth,
  gdpPerCapita: number,
  family: FamilyData,
  names: NamesData,
  world: FamilyData,
  politicsData?: PoliticsData,
): LifeState {
  const people = createFamily(seed, birth, names, family, world);
  const scales = initScales(gdpPerCapita);
  const finance = createFinance(gdpPerCapita);
  scales.bonds = bondsSummary(people);
  scales.money = moneyScale(finance);
  return {
    version: 10,
    seed,
    birth,
    age: 0,
    scales,
    happiness: 70,
    happinessHistory: [{ age: 0, year: birth.year, value: 70 }],
    focus: { current: "balance", fractions: {}, careerPoints: 0 },
    focusTotals: {},
    favoriteMomentIndexes: [],
    hobbies: [],
    activeHobbyId: null,
    time: { tick: 0, speed: 1, auto: false },
    plan: null,
    lifestyle: { autoGifts: false, autoCourses: false, autoHealth: false, autoTravel: false, autoHobbyLessons: false, insurance: false, nutrition: "normal" },
    pets: [],
    property: { items: [], acquired: {}, rentals: 0, business: null },
    compass: { tradition: 0, bonds: 0, choices: 0 },
    modifiers: [],
    chronicle: [],
    alive: true,
    deathYear: null,
    pendingEventIds: [],
    pendingFamilyEventId: null,
    usedEventIds: [],
    recentEvents: [],
    lastFamilySceneAge: null,
    lastOutcome: null,
    lastOutcomeKind: null,
    lastFamilyPersonId: null,
    lastArrows: null,
    softenHeavy: false,
    people,
    peopleNews: [],
    spouseId: null,
    sameSexPartners: rngFromSeed(`${seed}:partners`)() < 0.08,
    patterns: [],
    war: emptyWarState(),
    finance,
    politics: createPoliticsState(politicsData, birth.year),
    lineage: createLineageState(seed),
  };
}

function subRng(s: LifeState, salt: string): Rng {
  return rngFromSeed(`${s.seed}:${s.age}:${salt}`);
}

export function resolvePerson(s: LifeState, selector: PersonSelector, eventId: string, strained = false): Person | undefined {
  const year = s.birth.year + s.age;
  const active = s.people.filter((p) => p.alive && p.status === "active");
  if (selector === "closest") {
    return active.filter((p) => year - p.birthYear >= 3).sort((a, b) => relationshipOf(b) - relationshipOf(a) || a.id.localeCompare(b.id))[0];
  }
  let pool: Person[];
  if (selector === "anyParent") pool = active.filter((p) => p.role === "mother" || p.role === "father");
  else if (selector === "olderParent") pool = active.filter((p) => (p.role === "mother" || p.role === "father") && year - p.birthYear >= 60);
  else if (selector === "youngChild") pool = active.filter((p) => p.role === "child" && year - p.birthYear <= 5);
  else if (selector === "schoolChild") pool = active.filter((p) => p.role === "child" && year - p.birthYear >= 6 && year - p.birthYear <= 17);
  else if (selector === "teenChild") pool = active.filter((p) => p.role === "child" && year - p.birthYear >= 12 && year - p.birthYear <= 17);
  else if (selector === "adultChild") pool = active.filter((p) => p.role === "child" && year - p.birthYear >= 18);
  else pool = active.filter((p) => p.role === selector);
  if (pool.length === 0) return undefined;
  if (strained) return pool.sort((a, b) => relationshipOf(a) - relationshipOf(b) || a.id.localeCompare(b.id))[0];
  const rng = rngFromSeed(`${s.seed}:${s.age}:${eventId}:${selector}:person`);
  return pool[Math.floor(rng() * pool.length)];
}

export function eventText(s: LifeState, event: LifeEvent, text = event.text): string {
  const subject = event.subject ? resolvePerson(s, event.subject, event.id, event.crisis) : undefined;
  const year = s.birth.year + s.age;
  return text
    .replaceAll("{person}", subject?.name ?? "близкий человек")
    .replaceAll("{personAge}", subject ? String(year - subject.birthYear) : "")
    .replaceAll("{memory}", subject?.memories.at(-1)?.text ?? "пока нет общих воспоминаний");
}

function eligible(s: LifeState, events: LifeEvent[]): LifeEvent[] {
  return events.filter(
    (e) =>
      s.age >= e.minAge &&
      s.age <= e.maxAge &&
      !(e.heavy && s.softenHeavy) &&
      !(e.once && s.usedEventIds.includes(e.id)) &&
      !s.recentEvents.some((r) => r.id === e.id && s.age - r.age < EVENT_COOLDOWN_YEARS) &&
      (!e.subject || resolvePerson(s, e.subject, e.id, e.crisis)) &&
      (!e.condition || e.condition(s)),
  );
}

/** Обычные события года: на вехах и при кризисе — выбор до 3, иначе 1 по уместности. */
export function pickYearEvents(s: LifeState, events: LifeEvent[]): LifeEvent[] {
  const pool = eligible(s, events.map((event) => event.id === "after-school" ? careerEvent(s.seed, s.scales.education) : event));
  if (pool.length === 0) return [];
  const rng = subRng(s, "pick");
  const hasCrisis = pool.some((e) => e.crisis);
  const isMilestone = MILESTONE_AGES.includes(s.age);
  if (!isMilestone && !hasCrisis && rng() < QUIET_YEAR_CHANCE) return [];
  const count = isMilestone || hasCrisis ? Math.min(3, pool.length) : 1;
  const chosen: LifeEvent[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count; i++) {
    const idx = weightedIndex(rng, remaining.map((e) => weightOf(e, s)));
    chosen.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return chosen;
}

export function pickFamilyEvent(s: LifeState, events: LifeEvent[]): LifeEvent | null {
  if (s.lastFamilySceneAge !== null && s.age - s.lastFamilySceneAge < FAMILY_SCENE_INTERVAL) return null;
  const available = eligible(s, events);
  const crises = available.filter((e) => e.crisis);
  const pool = crises.length > 0 ? crises : available;
  if (pool.length === 0) return null;
  const rng = subRng(s, "family-pick");
  return pool[weightedIndex(rng, pool.map((e) => weightOf(e, s)))];
}

export function pickConflictEvent(s: LifeState, data: ConflictData): LifeEvent | null {
  const year = s.birth.year + s.age;
  const phase = conflictPhase(data, s.seed, year);
  if (s.war.seen.some((item) => item.year === year && item.phase === phase)) return null;
  if ((phase === "escalation" || phase === "deescalation") && s.war.seen.some((item) => (item.phase === "escalation" || item.phase === "deescalation") && year - item.year < WAR_PHASE_COOLDOWN_YEARS)) return null;
  const adult = s.age >= 18 && s.age <= 55 && s.scales.health > 30 && !s.softenHeavy;
  return conflictEventForPhase(phase, adult);
}

export function riskChance(s: LifeState, event: LifeEvent, choice: Choice): number {
  const base = choice.risk?.chance ?? 0;
  const target = resolvePerson(s, choice.target ?? event.subject ?? "closest", event.id, event.crisis);
  if (!target) return base;
  const advantage =
    (choice.sector === "bonds" && (target.traits.includes("warm") || target.traits.includes("loyal"))) ||
    (choice.sector === "tradition" && target.traits.includes("practical")) ||
    (choice.sector === "change" && target.traits.includes("curious"));
  const disadvantage =
    (choice.sector === "bonds" && target.traits.includes("stubborn")) ||
    (choice.sector === "tradition" && target.traits.includes("impulsive")) ||
    (choice.sector === "change" && target.traits.includes("stubborn"));
  if (advantage === disadvantage) return base;
  return advantage ? 1 - (1 - base) ** 2 : base ** 2;
}

function applyEffects(s: LifeState, effects: Partial<Scales>): void {
  for (const k of Object.keys(effects) as (keyof Scales)[]) {
    if (k !== "bonds") s.scales[k] = clampScale(s.scales[k] + (effects[k] ?? 0));
  }
  if (effects.money) applyMoneyEvent(s.finance, effects.money, s.birth.year + s.age);
}

function compassDelta(sector: Sector): { tradition: number; bonds: number } {
  return {
    tradition: sector === "tradition" ? 1 : sector === "change" ? -1 : 0,
    bonds: sector === "bonds" ? 1 : sector === "self" ? -1 : 0,
  };
}

function applyPersonAction(
  s: LifeState,
  action: PersonAction,
  target: Person | undefined,
  names: NamesData,
  eventId: string,
  conflicts?: ConflictData,
): Person | undefined {
  const year = s.birth.year + s.age;
  if (action === "evacuateTogether" || action === "evacuateAlone") {
    s.war.displacedUntil = Math.min(2100, (conflicts ? displacementSafeYear(conflicts, s.seed, year) : year) + 1);
    s.war.heroRisk = action === "evacuateTogether" ? 0.75 : 0.5;
    s.war.peopleDisplaced = action === "evacuateTogether";
    for (const p of s.people.filter((person) => person.alive && person.status === "active")) {
      s.war.peopleRisk[p.id] = action === "evacuateTogether" ? 0.5 : 1.5;
    }
    return target;
  }
  if (action === "protectPeople" || action === "civilianAid") {
    s.war.heroRisk = action === "protectPeople" ? 1.5 : 1.25;
    for (const p of s.people.filter((person) => person.alive && person.status === "active")) {
      s.war.peopleRisk[p.id] = action === "protectPeople" ? 0.5 : 0.75;
    }
    return target;
  }
  if (action === "combat") {
    s.war.heroCombat = true;
    return target;
  }
  if (action === "unemploy") {
    s.finance.employment = "unemployed";
    s.finance.unemployedUntil = year + FINANCE_RULES.unemploymentYears;
    return target;
  }
  if (action === "promote") {
    s.finance.careerLevel = Math.min(5, s.finance.careerLevel + 1);
    return target;
  }
  if (action === "work") {
    s.finance.employment = "employed";
    s.finance.unemployedUntil = null;
    return target;
  }
  if (action === "rent" || action === "parents" || action === "owned") {
    s.finance.housing = action;
    s.finance.mortgageYearsLeft = 0;
    return target;
  }
  if (action === "mortgage") {
    s.finance.housing = "mortgage";
    s.finance.mortgageYearsLeft = FINANCE_RULES.mortgageYears;
    return target;
  }
  if (action === "addPartner") {
    if (s.people.some((p) => p.role === "partner" && p.alive && p.status === "active")) return target;
    const id = `partner-${s.people.filter((p) => p.role === "partner").length}`;
    const sex = s.sameSexPartners ? s.birth.sex : s.birth.sex === "M" ? "F" : "M";
    const partnerAge = Math.max(s.age < 18 ? 13 : 18, s.age + Math.floor(subRng(s, `${eventId}:partner-age`)() * 11) - 5);
    const p = createPerson(`${s.seed}:${year}:${id}`, s.birth, names, id, "partner", sex, year - partnerAge, 55);
    s.people.push(p);
    return p;
  }
  if (action === "addFriend") {
    if (s.people.filter((p) => p.role === "friend" && p.alive && p.status === "active").length >= MAX_FRIENDS) return target;
    const id = `friend-${s.people.filter((p) => p.role === "friend").length}`;
    const sex: "M" | "F" = subRng(s, `${eventId}:friend-sex`)() < 0.5 ? "M" : "F";
    const friendAge = Math.max(5, s.age + Math.floor(subRng(s, `${eventId}:friend-age`)() * 11) - 5);
    const p = createPerson(`${s.seed}:${year}:${id}`, s.birth, names, id, "friend", sex, year - friendAge, 55);
    s.people.push(p);
    return p;
  }
  if (action === "haveChild") {
    if (s.people.filter((p) => p.role === "child").length >= MAX_CHILDREN) return target;
    const id = `child-${s.people.filter((p) => p.role === "child").length}`;
    const srb = s.birth.country.srb[Math.min(2100, year) - 1950];
    const sex = pickSex(subRng(s, `${eventId}:child-sex`), srb);
    const p = createPerson(`${s.seed}:${year}:${id}`, s.birth, names, id, "child", sex, year, 65);
    s.people.push(p);
    return p;
  }
  if (!target) return undefined;
  if (action === "marry") s.spouseId = target.id;
  if (action === "endPartner") {
    target.status = "ended";
    if (s.spouseId === target.id) s.spouseId = null;
  }
  if (action === "estrange") target.status = "estranged";
  if (action === "reconcile") target.status = "active";
  return target;
}

export function applyChoice(s: LifeState, event: LifeEvent, choiceIndex: number, names: NamesData, conflicts?: ConflictData): void {
  const choice: Choice = event.choices[choiceIndex];
  let outcome = choice.outcome;
  let arrows = { ...choice.effects };
  let target = resolvePerson(s, choice.target ?? event.subject ?? "closest", event.id, event.crisis);
  let action = choice.action;
  let succeeded = true;
  if (choice.risk) {
    const base = choice.risk.chance;
    const chance = riskChance(s, event, choice);
    const first = subRng(s, `${event.id}:risk:0`)() < base;
    const second = subRng(s, `${event.id}:risk:1`)() < base;
    succeeded = chance === base ? first : chance > base ? first || second : first && second;
    if (succeeded) {
      outcome = choice.risk.successText;
      arrows = choice.risk.successEffects;
      action = choice.risk.successAction ?? action;
    } else {
      outcome = choice.risk.failText;
      arrows = choice.risk.failEffects;
      action = choice.risk.failAction;
    }
  }
  if (choice.career) {
    s.finance.career = choice.career;
    s.finance.careerStartYear = s.birth.year + s.age;
    s.finance.careerLevel = 1;
    s.finance.employment = "employed";
    s.finance.education = s.scales.education;
  }
  applyEffects(s, arrows);
  const actionTarget = action ? applyPersonAction(s, action, target, names, event.id, conflicts) : undefined;
  if (action === "addPartner" || action === "addFriend" || action === "haveChild") target = actionTarget ?? target;
  else target ??= actionTarget;
  if (choice.mortality) {
    s.modifiers = s.modifiers.filter((m) => m.id !== event.id);
    s.modifiers.push({ id: event.id, mult: choice.mortality.mult, untilAge: choice.mortality.untilAge });
  }
  if (target && (event.subject || event.family || event.conflict || arrows.bonds)) {
    const impact = arrows.bonds ?? 0;
    remember(target, s.age, s.birth.year + s.age, event.id, eventText(s, event, outcome), impact, impact < 0 ? "conflict" : impact > 0 ? "support" : "milestone");
    const unknown = target.traits.find((trait) => !target.knownTraits.includes(trait));
    if (unknown) target.knownTraits.push(unknown);
  }
  s.scales.bonds = bondsSummary(s.people);
  const delta = compassDelta(choice.sector);
  s.compass.tradition += delta.tradition;
  s.compass.bonds += delta.bonds;
  s.compass.choices++;
  const renderedOutcome = eventText(s, event, outcome).replaceAll("{result}", succeeded ? "успех" : "неудача");
  s.chronicle.push({ age: s.age, year: s.birth.year + s.age, text: renderedOutcome, source: "hero" });
  if (event.once) s.usedEventIds.push(event.id);
  s.recentEvents.push({ id: event.id, age: s.age });
  if (s.recentEvents.length > 30) s.recentEvents.shift();
  s.lastOutcome = renderedOutcome;
  s.lastOutcomeKind = event.conflict ? "conflict" : event.family ? "family" : "life";
  s.lastFamilyPersonId = (event.family || event.conflict) && (event.subject || actionTarget) ? target?.id ?? null : null;
  s.lastArrows = arrows;
  if (event.conflict) {
    s.war.pendingEventId = null;
    if (conflicts) s.war.seen.push({ year: s.birth.year + s.age, phase: conflictPhase(conflicts, s.seed, s.birth.year + s.age) });
  } else if (event.family) {
    s.pendingFamilyEventId = null;
    s.lastFamilySceneAge = s.age;
  } else {
    s.pendingEventIds = s.pendingEventIds.filter((id) => id !== event.id);
  }
}

/** Завершение года после всех сцен: новости близких, смерть героя или +1 год. */
export function advanceYear(s: LifeState, mort: MortData, family: FamilyData, names: NamesData, conflicts?: ConflictData, gdpPerCapita?: number, politicsData?: PoliticsData): void {
  if (!s.alive) return;
  completeFocusYear(s);
  const currentYear = s.birth.year + s.age;
  if (politicsData) {
    processPoliticsYear(s, politicsData, currentYear);
    s.finance.gdpPerCapita = alternativeGdp(s, gdpPerCapita ?? s.finance.gdpPerCapita);
  } else if (gdpPerCapita !== undefined) s.finance.gdpPerCapita = gdpPerCapita;
  const news = advancePeople(s.seed, s.birth, names, family, s.people, mort, currentYear, conflicts, s.war);
  s.peopleNews = news;
  for (const item of news) {
    if (s.spouseId === item.personId && s.people.find((p) => p.id === item.personId)?.status === "ended") s.spouseId = null;
    s.chronicle.push({ age: s.age, year: currentYear, text: item.text, source: "people" });
  }
  for (const text of detectPatterns(s)) {
    news.push({ kind: "turn", personId: "", age: s.age, year: currentYear, text });
    s.chronicle.push({ age: s.age, year: currentYear, text, source: "pattern" });
  }
  processFinanceYear(s, currentYear);
  processPlanYear(s);
  processLifestyleYear(s);
  s.scales.bonds = bondsSummary(s.people);
  const tableYear = Math.min(currentYear, 2100);
  const base = mort.q[s.birth.sex][tableYear - 1950][Math.min(s.age, 100)] / mort.scale;
  const conflictRow = conflicts ? conflictForYear(conflicts, s.seed, currentYear) : null;
  const displaced = s.war.displacedUntil !== null && s.war.displacedUntil >= currentYear ? 0.5 : 1;
  const conflictQ = conflictRow
    ? conflictHazard(conflictRow).civilian * s.war.heroRisk * displaced + (s.war.heroCombat ? conflictHazard(conflictRow).parties : 0)
    : 0;
  s.war.heroRisk = 1;
  s.war.heroCombat = false;
  s.war.peopleRisk = {};
  const died = subRng(s, "death")() < Math.min(1, base * mortalityMultiplier(s) * alternativeMortality(s) + conflictQ);
  if (s.war.displacedUntil !== null && s.war.displacedUntil <= currentYear) {
    s.war.displacedUntil = null;
    s.war.peopleDisplaced = false;
  }
  if (died) {
    s.alive = false;
    s.deathYear = currentYear;
    recordHappiness(s);
    return;
  }
  s.age++;
  recordHappiness(s);
  if (s.age >= 50) s.scales.health = clampScale(s.scales.health - (s.age >= 70 ? 1.2 : 0.5));
  const year = s.birth.year + s.age;
  for (const h of HISTORY) {
    if (h.year === year) s.chronicle.push({ age: s.age, year, text: h.text, source: "history" });
  }
  s.lastOutcome = null;
  s.lastOutcomeKind = null;
  s.lastFamilyPersonId = null;
  s.lastArrows = null;
  s.pendingFamilyEventId = null;
}
