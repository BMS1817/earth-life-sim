import type { PoliticalLevel, PoliticalPlatform } from "../core/politics.ts";

export const POLITICS_RULES = {
  localExperienceForRegional: 2,
  regionalExperienceForNational: 3,
  nationalEducation: 40,
  effectLagYears: 3,
  minGdpFactor: 0.9,
  maxGdpFactor: 1.1,
  minMortalityFactor: 0.92,
  maxMortalityFactor: 1.08,
  campaignCost: { local: 0.02, regional: 0.08, national: 0.2 } as Record<PoliticalLevel, number>,
  syntheticCycle: { local: 4, regional: 4, national: 5 } as Record<PoliticalLevel, number>,
} as const;

export const PLATFORMS: Record<PoliticalPlatform, { support: number; happiness: number; bonds: number }> = {
  community: { support: 5, happiness: 1, bonds: 3 },
  welfare: { support: 4, happiness: 3, bonds: 1 },
  market: { support: 2, happiness: -2, bonds: 0 },
  order: { support: 3, happiness: -1, bonds: 0 },
};

export const USURPATION_EFFECTS = { gdp: -0.01, mortality: 0.01 } as const;

export const POLITICS_LEVEL_TEXT: Record<PoliticalLevel, string> = {
  local: "местный",
  regional: "региональный",
  national: "национальный",
};

export const POLITICS_PLATFORM_TEXT: Record<PoliticalPlatform, string> = {
  community: "сообщество",
  welfare: "социальная поддержка",
  market: "рынок",
  order: "порядок",
};
