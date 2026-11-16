export type Sex = "M" | "F";

export interface CountryEntry {
  code: number;
  iso2: string | null;
  iso3: string;
  name: string;
  births: number[];
  srb: number[];
}

export interface IndexData {
  source: string;
  years: [number, number];
  countries: CountryEntry[];
}

export interface MortData {
  code: number;
  scale: number;
  e0: Record<Sex, number[]>;
  q: Record<Sex, number[][]>;
}

export interface NamesData {
  countries: Record<string, { M: string[]; F: string[] }>;
}

export interface HouseholdObservation {
  year: number;
  size: number | null;
  children: number | null;
  singleParent: number | null;
}

export interface FamilyData {
  code: number;
  households: HouseholdObservation[];
  tfr: number[];
  motherAge: number[][];
}

export interface Birth {
  year: number;
  country: CountryEntry;
  sex: Sex;
  name: string;
}
