import { HOBBY_LEVEL_XP } from "../content/focus.ts";
import { INHERITANCE_RULES } from "../content/inheritance.ts";
import { moneyScale } from "./finance.ts";
import { favoriteMoments, lifePattern } from "./memorial.ts";
import type { PatternName } from "./memorial.ts";
import { bondsSummary } from "./people.ts";
import type { Person, Trait } from "./people.ts";
import { createPoliticsState } from "./politics.ts";
import type { PoliticsData } from "./politics.ts";
import { hashSeed } from "./rng.ts";
import { clampScale } from "./state.ts";
import type { ChronicleEntry, HobbyState, LifeState } from "./state.ts";
import { createLifeState } from "./turn.ts";
import type { Birth, FamilyData, NamesData } from "./types.ts";

export interface AncestorState {
  name: string;
  sex: "M" | "F";
  birthYear: number;
  deathYear: number;
  countryIso3: string;
  patternName: PatternName;
  patternColor: string;
  moments: ChronicleEntry[];
}

export interface InheritanceReport {
  year: number;
  parentName: string;
  heirName: string;
  childrenCount: number;
  cashShare: number;
  bondsShare: number;
  riskyShare: number;
  insurance: number;
  rentals: number;
  business: boolean;
  education: number;
  trait: Trait;
}

export interface LineageState {
  generation: number;
  ancestors: AncestorState[];
  heroTraits: Trait[];
  lastInheritance: InheritanceReport | null;
}

export function createLineageState(seed?: string): LineageState {
  return { generation: 1, ancestors: [], heroTraits: seed ? initialHeroTraits(seed) : [], lastInheritance: null };
}

export function eligibleHeirs(s: LifeState): Person[] {
  return s.people.filter((person) => person.role === "child" && person.alive);
}

const TRAITS: Trait[] = ["warm", "reserved", "stubborn", "curious", "practical", "impulsive", "loyal", "independent"];

export function initialHeroTraits(seed: string): Trait[] {
  const pool = [...TRAITS];
  const result: Trait[] = [];
  let value = hashSeed(`${seed}:hero-traits`);
  while (result.length < 3) {
    value = hashSeed(`${value}:trait`);
    result.push(pool.splice(value % pool.length, 1)[0]);
  }
  return result;
}

function ancestorOf(s: LifeState): AncestorState {
  const pattern = lifePattern(s);
  return {
    name: s.birth.name,
    sex: s.birth.sex,
    birthYear: s.birth.year,
    deathYear: s.deathYear ?? s.birth.year + s.age,
    countryIso3: s.birth.country.iso3,
    patternName: pattern.name,
    patternColor: pattern.color,
    moments: favoriteMoments(s).map(({ age, year, text, source }) => ({ age, year, text, source })),
  };
}

function parentAsPerson(s: LifeState, heir: Person): Person {
  const traits = s.lineage.heroTraits.length > 0 ? [...s.lineage.heroTraits] : initialHeroTraits(s.seed);
  return {
    id: `hero-${s.lineage.generation}`,
    name: s.birth.name,
    sex: s.birth.sex,
    birthYear: s.birth.year,
    role: s.birth.sex === "F" ? "mother" : "father",
    traits,
    knownTraits: [...traits],
    initialRelationship: heir.initialRelationship,
    memories: structuredClone(heir.memories),
    alive: false,
    deathYear: s.deathYear,
    status: "active",
    present: true,
  };
}

function inheritedPeople(s: LifeState, heir: Person): Person[] {
  const parent = parentAsPerson(s, heir);
  const people = s.people.filter((person) => person.id !== heir.id).map((person) => {
    const copy = structuredClone(person);
    if (copy.role === "partner") copy.role = copy.sex === "F" ? "mother" : "father";
    else if (copy.role === "child") copy.role = "sibling";
    else if (copy.role === "mother" || copy.role === "father") copy.role = "grandparent";
    else if (copy.role === "sibling") copy.role = "relative";
    return copy;
  });
  people.push(parent);
  return people;
}

function inheritedHobbies(s: LifeState): HobbyState[] {
  return s.hobbies.map((hobby) => {
    const xp = hobby.xp * INHERITANCE_RULES.hobbyXpShare;
    let level = 0;
    for (let next = 1; next <= 10; next++) if (xp >= HOBBY_LEVEL_XP[next]) level = next;
    return { id: hobby.id, xp, level };
  });
}

export function inheritLife(
  parent: LifeState,
  heirId: string,
  family: FamilyData,
  names: NamesData,
  world: FamilyData,
  politicsData?: PoliticsData,
): { state: LifeState; report: InheritanceReport } | null {
  if (parent.alive || parent.deathYear === null) return null;
  const heir = eligibleHeirs(parent).find((person) => person.id === heirId);
  if (!heir) return null;
  const year = parent.deathYear;
  const generation = parent.lineage.generation + 1;
  const childrenCount = eligibleHeirs(parent).length;
  const trait = (parent.lineage.heroTraits.length > 0 ? parent.lineage.heroTraits : initialHeroTraits(parent.seed))[0];
  const insurance = parent.lifestyle.insurance ? parent.finance.gdpPerCapita * INHERITANCE_RULES.insuranceGdpMultiplier : 0;
  const report: InheritanceReport = {
    year,
    parentName: parent.birth.name,
    heirName: heir.name,
    childrenCount,
    cashShare: parent.finance.cash / childrenCount,
    bondsShare: parent.finance.bonds / childrenCount,
    riskyShare: parent.finance.risky / childrenCount,
    insurance,
    rentals: Math.ceil(parent.property.rentals / childrenCount),
    business: parent.property.business !== null,
    education: Math.max(5, Math.min(INHERITANCE_RULES.educationCap, Math.floor(parent.scales.education * INHERITANCE_RULES.educationShare))),
    trait,
  };
  const birth: Birth = { year: heir.birthYear, country: parent.birth.country, sex: heir.sex, name: heir.name };
  const state = createLifeState(`${parent.seed}:${heir.id}:${generation}`, birth, parent.finance.gdpPerCapita, family, names, world, politicsData);
  state.age = Math.max(0, year - heir.birthYear);
  state.scales.education = report.education;
  state.scales.health = clampScale(80 - Math.max(0, state.age - 50) * 0.5);
  state.hobbies = inheritedHobbies(parent);
  if (!state.hobbies.some((hobby) => hobby.id === state.activeHobbyId)) state.activeHobbyId = state.hobbies[0]?.id ?? null;
  const heirTraits = [...heir.traits];
  if (!heirTraits.includes(trait)) heirTraits[heirTraits.length - 1] = trait;
  state.people = inheritedPeople(parent, heir);
  state.scales.bonds = bondsSummary(state.people);
  state.finance.cash = report.cashShare + report.insurance;
  state.finance.bonds = report.bondsShare;
  state.finance.risky = report.riskyShare;
  state.finance.education = report.education;
  state.finance.employment = state.age >= 18 ? "unemployed" : "school";
  state.finance.housing = parent.property.items.includes("home") ? "owned" : state.age >= 18 ? "rent" : "parents";
  state.scales.money = moneyScale(state.finance);
  state.property = {
    items: [...parent.property.items],
    acquired: { ...parent.property.acquired },
    rentals: report.rentals,
    business: parent.property.business ? { ...parent.property.business } : null,
  };
  state.pets = parent.pets.filter((pet) => pet.deathYear === null).map((pet) => ({ ...pet }));
  state.lifestyle = { ...parent.lifestyle, insurance: false };
  state.politics.constitution = { ...parent.politics.constitution };
  state.politics.alternative = structuredClone(parent.politics.alternative);
  state.politics.lastResult = null;
  state.time.speed = parent.time.speed;
  state.softenHeavy = parent.softenHeavy;
  state.happinessHistory = [{ age: state.age, year, value: state.happiness }];
  state.lineage = {
    generation,
    ancestors: [...parent.lineage.ancestors, ancestorOf(parent)],
    heroTraits: heirTraits,
    lastInheritance: report,
  };
  state.chronicle = [{ age: state.age, year, text: `${heir.name} продолжает род после ${parent.birth.name}. Поколение ${generation}.`, source: "hero" }];
  state.lastOutcome = `Новая жизнь в поколении ${generation}. Наследие и семейная история сохранены.`;
  state.lastOutcomeKind = "life";
  return { state, report };
}
