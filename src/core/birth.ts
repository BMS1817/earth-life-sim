import type { Rng } from "./rng.ts";
import { weightedIndex } from "./rng.ts";
import type { IndexData, NamesData, Sex } from "./types.ts";

export const FIRST_BIRTH_YEAR = 1950;
export const LAST_BIRTH_YEAR = 2026;

export function yearWeights(index: IndexData): number[] {
  const [y0] = index.years;
  const weights: number[] = [];
  for (let y = FIRST_BIRTH_YEAR; y <= LAST_BIRTH_YEAR; y++) {
    let total = 0;
    for (const c of index.countries) total += c.births[y - y0];
    weights.push(total);
  }
  return weights;
}

export function pickBirthYear(rng: Rng, index: IndexData, weights: number[]): number {
  return FIRST_BIRTH_YEAR + weightedIndex(rng, weights);
}

export function pickCountryIndex(rng: Rng, index: IndexData, year: number): number {
  const [y0] = index.years;
  const weights = index.countries.map((c) => c.births[year - y0]);
  return weightedIndex(rng, weights);
}

export function pickSex(rng: Rng, srb: number): Sex {
  return rng() < srb / (1 + srb) ? "M" : "F";
}

export function pickName(rng: Rng, names: NamesData, iso2: string | null, sex: Sex): string {
  const list = (iso2 && names.countries[iso2]?.[sex]) || names.countries.US[sex];
  return list[Math.floor(rng() * list.length)];
}
