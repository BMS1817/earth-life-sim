import type { Rng } from "./rng.ts";
import { weightedIndex } from "./rng.ts";
import { pickBirthYear, pickCountryIndex, pickName, pickSex, yearWeights } from "./birth.ts";
import type { Birth, IndexData, NamesData } from "./types.ts";

const weightsCache = new WeakMap<IndexData, number[]>();

export function createBirth(rng: Rng, index: IndexData, names: NamesData): Birth {
  let weights = weightsCache.get(index);
  if (!weights) {
    weights = yearWeights(index);
    weightsCache.set(index, weights);
  }
  const year = pickBirthYear(rng, index, weights);
  const country = index.countries[pickCountryIndex(rng, index, year)];
  const sex = pickSex(rng, country.srb[year - index.years[0]]);
  const name = pickName(rng, names, country.iso2, sex);
  return { year, country, sex, name };
}

export { weightedIndex };
