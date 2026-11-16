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
  balance: { minAge: 0, happiness: 0.2, health: 0, education: 0, money: 0, bonds: 0, hobbyXp: 0.25, careerPoints: 0 },
  study: { minAge: 5, happiness: -0.5, health: 0, education: 1.5, money: 0, bonds: -0.25, hobbyXp: 0.25, careerPoints: 0 },
  relationships: { minAge: 0, happiness: 0.75, health: 0, education: -0.25, money: 0, bonds: 1, hobbyXp: 0.25, careerPoints: 0 },
  health: { minAge: 0, happiness: 0.25, health: 1.25, education: 0, money: -0.25, bonds: 0, hobbyXp: 0.25, careerPoints: 0 },
  hobby: { minAge: 5, happiness: 1.25, health: 0, education: -0.25, money: 0, bonds: 0, hobbyXp: 1.5, careerPoints: 0, requiresHobby: true },
  work: { minAge: 18, happiness: -0.5, health: -0.5, education: 0, money: 0.5, bonds: -0.5, hobbyXp: 0.1, careerPoints: 1, requiresCareer: true },
  growth: { minAge: 12, happiness: -0.25, health: 0, education: 0.75, money: 0, bonds: 0, hobbyXp: 0.35, careerPoints: 0.5 },
  rest: { minAge: 18, happiness: 1, health: 0.75, education: 0, money: -0.5, bonds: 0, hobbyXp: 0.25, careerPoints: 0 },
};
