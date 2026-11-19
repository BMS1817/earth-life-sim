import { pickName, pickSex } from "./birth.ts";
import { rngFromSeed, weightedIndex } from "./rng.ts";
import type { Rng } from "./rng.ts";
import type { Birth, FamilyData, MortData, NamesData, Sex } from "./types.ts";
import { conflictForYear, conflictHazard } from "./conflicts.ts";
import type { ConflictData, WarState } from "./conflicts.ts";

export type PersonRole = "mother" | "father" | "sibling" | "partner" | "child" | "friend" | "grandparent" | "relative";
export type PersonStatus = "active" | "estranged" | "ended";
export type Trait = "warm" | "reserved" | "stubborn" | "curious" | "practical" | "impulsive" | "loyal" | "independent";
export type MemoryKind = "support" | "conflict" | "care" | "loss" | "milestone";

export interface Memory {
  age: number;
  year: number;
  eventId: string;
  text: string;
  impact: number;
  kind: MemoryKind;
}

export interface Person {
  id: string;
  name: string;
  sex: Sex;
  birthYear: number;
  role: PersonRole;
  traits: Trait[];
  knownTraits: Trait[];
  initialRelationship: number;
  memories: Memory[];
  alive: boolean;
  deathYear: number | null;
  status: PersonStatus;
  present: boolean;
}

export interface PeopleNews {
  kind: "death" | "birth" | "turn";
  personId: string;
  age: number;
  year: number;
  text: string;
}

export const MOTHER_AGE_BANDS = [10, 15, 20, 25, 30, 35, 40, 45, 50];
export const MIN_BIRTH_INTERVAL = 2;

const TRAITS: Trait[] = ["warm", "reserved", "stubborn", "curious", "practical", "impulsive", "loyal", "independent"];

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

function traits(rng: Rng): Trait[] {
  const pool = [...TRAITS];
  const result: Trait[] = [];
  while (result.length < 3) result.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return result;
}

function person(
  rng: Rng,
  names: NamesData,
  birth: Birth,
  id: string,
  role: PersonRole,
  sex: Sex,
  birthYear: number,
  initialRelationship: number,
  present = true,
): Person {
  return {
    id,
    name: pickName(rng, names, birth.country.iso2, sex),
    sex,
    birthYear,
    role,
    traits: traits(rng),
    knownTraits: [],
    initialRelationship,
    memories: [],
    alive: true,
    deathYear: null,
    status: "active",
    present,
  };
}

export function personAge(p: Person, year: number): number {
  return Math.max(0, year - p.birthYear);
}

export function relationshipOf(p: Person): number {
  return clamp(p.initialRelationship + p.memories.reduce((sum, memory) => sum + memory.impact, 0));
}

export function bondsSummary(people: Person[]): number {
  const active = people.filter((p) => p.alive && p.status === "active");
  if (active.length === 0) return 0;
  return active.reduce((sum, p) => sum + relationshipOf(p), 0) / active.length;
}

export function remember(
  p: Person,
  age: number,
  year: number,
  eventId: string,
  text: string,
  impact: number,
  kind: MemoryKind,
): void {
  p.memories.push({ age, year, eventId, text, impact, kind });
}

function observed(
  rows: { year: number; value: number }[],
  year: number,
): number {
  if (year <= rows[0].year) return rows[0].value;
  if (year >= rows[rows.length - 1].year) return rows[rows.length - 1].value;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].year < year) continue;
    const a = rows[i - 1];
    const b = rows[i];
    const t = (year - a.year) / (b.year - a.year);
    return a.value + (b.value - a.value) * t;
  }
  return rows[0].value;
}

export function householdMetric(
  family: FamilyData,
  world: FamilyData,
  year: number,
  key: "size" | "children" | "singleParent",
): { value: number; estimated: boolean } {
  const rows = family.households
    .filter((row) => row[key] !== null)
    .map((row) => ({ year: row.year, value: row[key]! }));
  if (rows.length > 0) return { value: observed(rows, year), estimated: !family.households.some((row) => row.year === year && row[key] !== null) };
  const fallback = world.households
    .filter((row) => row[key] !== null)
    .map((row) => ({ year: row.year, value: row[key]! }));
  return { value: observed(fallback, year), estimated: true };
}

export function motherAgeWeights(family: FamilyData, year: number): number[] {
  return family.motherAge[Math.min(2100, Math.max(1950, year)) - 1950];
}

function poisson(rng: Rng, lambda: number): number {
  const limit = Math.exp(-lambda);
  let product = rng();
  let count = 0;
  while (product > limit) {
    count++;
    product *= rng();
  }
  return count;
}

function siblingCapacity(motherAge: number): number {
  return motherAge < 14 ? 0 : Math.floor((motherAge - 14) / MIN_BIRTH_INTERVAL) + 1;
}

function cappedPoissonMean(lambda: number, weights: number[]): number {
  let result = 0;
  for (let band = 0; band < weights.length; band++) {
    for (let offset = 0; offset < 5; offset++) {
      const capacity = siblingCapacity(MOTHER_AGE_BANDS[band] + offset);
      if (capacity === 0) continue;
      let probability = Math.exp(-lambda);
      let cumulative = probability;
      let expected = 0;
      for (let k = 1; k < capacity; k++) {
        probability *= lambda / k;
        cumulative += probability;
        expected += k * probability;
      }
      result += (expected + capacity * Math.max(0, 1 - cumulative)) * weights[band] / 5;
    }
  }
  return result;
}

const lambdaCache = new Map<string, number>();

export function olderSiblingLambda(family: FamilyData, year: number, target: number): number {
  if (target <= 0) return 0;
  const key = `${family.code}:${year}:${target.toFixed(4)}`;
  const cached = lambdaCache.get(key);
  if (cached !== undefined) return cached;
  const weights = motherAgeWeights(family, year);
  let low = 0;
  let high = Math.max(1, target + 1);
  while (cappedPoissonMean(high, weights) < target) high *= 2;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (cappedPoissonMean(mid, weights) < target) low = mid;
    else high = mid;
  }
  const result = (low + high) / 2;
  lambdaCache.set(key, result);
  return result;
}

export function createFamily(
  seed: string,
  birth: Birth,
  names: NamesData,
  family: FamilyData,
  world: FamilyData,
): Person[] {
  const rng = rngFromSeed(`${seed}:family`);
  const weights = motherAgeWeights(family, birth.year);
  const band = MOTHER_AGE_BANDS[weightedIndex(rng, weights)];
  const motherAge = band + Math.floor(rng() * 5);
  const fatherAge = Math.max(16, motherAge + Math.floor(rng() * 10) - 2);
  const single = householdMetric(family, world, birth.year, "singleParent");
  const singleParent = rng() < single.value;
  const absent: "mother" | "father" = rng() < 0.9 ? "father" : "mother";
  const people = [
    person(rng, names, birth, "mother", "mother", "F", birth.year - motherAge, singleParent && absent === "mother" ? 35 : 70, !(singleParent && absent === "mother")),
    person(rng, names, birth, "father", "father", "M", birth.year - fatherAge, singleParent && absent === "father" ? 35 : 70, !(singleParent && absent === "father")),
  ];
  const children = householdMetric(family, world, birth.year, "children");
  const lambda = olderSiblingLambda(family, birth.year, Math.max(0, children.value - 1));
  const count = poisson(rng, lambda);
  const possibleMotherAges: number[] = [];
  for (let age = 12; age <= motherAge - MIN_BIRTH_INTERVAL; age += MIN_BIRTH_INTERVAL) possibleMotherAges.push(age);
  const birthCount = Math.min(count, possibleMotherAges.length);
  for (let i = 0; i < birthCount; i++) {
    const pick = Math.floor(rng() * possibleMotherAges.length);
    const motherAtBirth = possibleMotherAges.splice(pick, 1)[0];
    const siblingYear = birth.year - (motherAge - motherAtBirth);
    const srb = birth.country.srb[Math.min(2100, Math.max(1950, siblingYear)) - 1950];
    const sex = pickSex(rng, srb);
    people.push(person(rng, names, birth, `sibling-${i}`, "sibling", sex, siblingYear, 60));
  }
  return people;
}

export function createPerson(
  seed: string,
  birth: Birth,
  names: NamesData,
  id: string,
  role: PersonRole,
  sex: Sex,
  birthYear: number,
  initialRelationship = 55,
): Person {
  return person(rngFromSeed(seed), names, birth, id, role, sex, birthYear, initialRelationship);
}

export function annualSiblingBirthChance(family: FamilyData, year: number, motherAge: number): number {
  if (motherAge < 10 || motherAge > 54) return 0;
  const band = Math.floor(motherAge / 5) * 5;
  const bandIndex = MOTHER_AGE_BANDS.indexOf(band);
  if (bandIndex < 0) return 0;
  const y = Math.min(2100, Math.max(1950, year)) - 1950;
  return Math.min(1, family.tfr[y] * family.motherAge[y][bandIndex] / 5);
}

function maybeSibling(
  seed: string,
  birth: Birth,
  names: NamesData,
  family: FamilyData,
  people: Person[],
  year: number,
): Person | null {
  const mother = people.find((p) => p.id === "mother");
  if (!mother?.alive || year <= birth.year) return null;
  const motherAge = year - mother.birthYear;
  const previousBirths = [birth.year, ...people.filter((p) => p.role === "sibling").map((p) => p.birthYear)];
  if (year - Math.max(...previousBirths) < MIN_BIRTH_INTERVAL) return null;
  const rng = rngFromSeed(`${seed}:${year}:sibling-birth`);
  if (rng() >= annualSiblingBirthChance(family, year, motherAge)) return null;
  const id = `sibling-${people.filter((p) => p.role === "sibling").length}`;
  if (people.some((p) => p.id === id)) return null;
  const srb = birth.country.srb[Math.min(2100, Math.max(1950, year)) - 1950];
  const sex = pickSex(rng, srb);
  return person(rng, names, birth, id, "sibling", sex, year, 60);
}

function deathText(p: Person): string {
  const role = p.role === "mother" ? "мать" : p.role === "father" ? "отец" : p.role === "sibling" ? (p.sex === "F" ? "сестра" : "брат") : p.role === "child" ? (p.sex === "F" ? "дочь" : "сын") : p.role === "partner" ? (p.sex === "F" ? "партнёрша" : "партнёр") : (p.sex === "F" ? "подруга" : "друг");
  return `Умер${p.sex === "F" ? "ла" : ""} ${role} ${p.name}.`;
}

const KEY_TURNS: Record<number, string> = {
  20: "переезд и начало самостоятельной жизни",
  35: "новая работа и другой ритм",
  55: "смена места жизни",
  75: "болезнь и потребность в поддержке",
};

export function advancePeople(
  seed: string,
  birth: Birth,
  names: NamesData,
  family: FamilyData,
  people: Person[],
  mort: MortData,
  year: number,
  conflictData?: ConflictData,
  war?: WarState,
): PeopleNews[] {
  const news: PeopleNews[] = [];
  const sibling = maybeSibling(seed, birth, names, family, people, year);
  if (sibling) {
    people.push(sibling);
    news.push({ kind: "birth", personId: sibling.id, age: 0, year, text: `${sibling.sex === "F" ? "Родилась сестра" : "Родился брат"} ${sibling.name}.` });
  }
  const conflictRow = conflictData && war ? conflictForYear(conflictData, seed, year) : null;
  const civilianHazard = conflictRow ? conflictHazard(conflictRow).civilian : 0;
  for (const p of people) {
    if (!p.alive || p.birthYear > year) continue;
    const age = year - p.birthYear;
    const tableYear = Math.min(2100, Math.max(1950, year));
    const displaced = war?.displacedUntil !== null && war?.displacedUntil !== undefined && war.displacedUntil >= year && war.peopleDisplaced ? 0.5 : 1;
    const risk = war?.peopleRisk[p.id] ?? 1;
    const conflictQ = civilianHazard * displaced * risk;
    const q = mort.q[p.sex][tableYear - 1950][Math.min(age, 100)] / mort.scale + conflictQ;
    if (rngFromSeed(`${seed}:${year}:${p.id}:death`)() < Math.min(1, q)) {
      p.alive = false;
      p.deathYear = year;
      news.push({ kind: "death", personId: p.id, age: year - birth.year, year, text: deathText(p) });
      continue;
    }
    const turn = KEY_TURNS[age];
    if (turn && rngFromSeed(`${seed}:${p.id}:${age}:turn`)() < 0.22) {
      news.push({ kind: "turn", personId: p.id, age: year - birth.year, year, text: `${p.name}: ${turn}.` });
    }
    if ((p.role === "partner" || p.role === "friend") && p.status === "active") {
      const warningId = p.role === "partner" ? "family-partner-crisis" : "family-friend-crisis";
      const warned = p.memories.some((m) => m.eventId === warningId && year - m.year <= 3);
      const threshold = p.traits.includes("loyal") && relationshipOf(p) > 0 ? 0 : 25;
      if (warned && relationshipOf(p) < threshold) {
        p.status = "ended";
        news.push({ kind: "turn", personId: p.id, age: year - birth.year, year, text: `${p.name}: ваши отношения закончились после долгого охлаждения.` });
      }
    }
  }
  return news;
}
