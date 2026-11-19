import type { FocusId, HobbyId } from "../core/state.ts";

export const TICKS_PER_YEAR = 16;
export const YEAR_MS = 48_000;
export const AUTO_DELAY_MS = 5_000;
export const SPEEDS = [1, 2, 4, 8, 16] as const;
export const HOBBY_LEVEL_XP = [0, 1, 2, 4, 7, 11, 16, 22, 29, 37, 45];
export const HOBBY_IDS: HobbyId[] = ["games", "sports", "reading", "music", "crafts", "nature"];

export interface FocusProfile {
  minAge: number;
  happiness: number;
  health: number;
  education: number;
  money: number;
  bonds: number;
  hobbyXp: number;
  careerPoints: number;
  requiresHobby?: boolean;
  requiresCareer?: boolean;
}

export const FOCUS_PROFILES: Record<FocusId, FocusProfile> = {
  balance: { minAge: 0, happiness: 0.5, health: 0.5, education: 0.5, money: 0.5, bonds: 0.5, hobbyXp: 0.5, careerPoints: 0 },
  money: { minAge: 18, happiness: -0.5, health: 0, education: -0.5, money: 2, bonds: -0.5, hobbyXp: 0.25, careerPoints: 1, requiresCareer: true },
  education: { minAge: 5, happiness: -0.5, health: -0.5, education: 2, money: -0.5, bonds: 0, hobbyXp: 0.25, careerPoints: 0.5 },
  bonds: { minAge: 0, happiness: 0.5, health: 0.5, education: 0, money: -0.5, bonds: 2, hobbyXp: 0.25, careerPoints: 0 },
  happiness: { minAge: 0, happiness: 2, health: 0.5, education: -0.5, money: -0.5, bonds: 0, hobbyXp: 0.5, careerPoints: 0 },
};
