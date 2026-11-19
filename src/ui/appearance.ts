import { hashSeed } from "../core/rng.ts";
import type { Sex } from "../core/types.ts";

export const AGE_STAGES = ["infant", "early", "child", "teen", "young", "adult", "mature", "senior", "elder"] as const;
export type AgeStage = (typeof AGE_STAGES)[number];
export type Appearance = {
  face: number;
  body: 0 | 1 | 2;
  skin: number;
  sex: Sex;
};

export function ageStageForAge(age: number): AgeStage {
  if (age <= 2) return "infant";
  if (age <= 6) return "early";
  if (age <= 12) return "child";
  if (age <= 17) return "teen";
  if (age <= 29) return "young";
  if (age <= 44) return "adult";
  if (age <= 59) return "mature";
  if (age <= 79) return "senior";
  return "elder";
}

export function appearanceForSeed(seed: string, sex: Sex): Appearance {
  return {
    face: hashSeed(`${seed}:face`) % 6,
    body: (hashSeed(`${seed}:body`) % 3) as 0 | 1 | 2,
    skin: hashSeed(`${seed}:skin`) % 6,
    sex,
  };
}
