import type { FocusId } from "../core/state.ts";
import type { CareerId } from "../core/finance.ts";

export const MAX_FAVORITE_MOMENTS = 32;
export const BIOGRAPHY_LIMIT = 12;
export const ALBUM_LIMIT = 6;
export const FINAL_SCENE_LIMIT = 3;

export const FOCUS_HUES: Record<FocusId, number> = {
  balance: 42,
  study: 215,
  relationships: 330,
  health: 135,
  hobby: 285,
  work: 22,
  growth: 185,
  rest: 96,
};

export const DREAM_CAREERS: Record<FocusId, CareerId> = {
  balance: "services",
  study: "medicine",
  relationships: "education",
  health: "medicine",
  hobby: "services",
  work: "engineering",
  growth: "engineering",
  rest: "agriculture",
};

export const MEMORIAL_PALETTE = {
  wall: "#2c2147",
  wallLight: "#554078",
  floor: "#30213e",
  floorLight: "#49375f",
  wood: "#76503c",
  gold: "#c79a52",
  light: "#f0d58a",
  paper: "#f0dfa8",
  ink: "#171226",
  night: "#100d1b",
  green: "#82b77a",
  blue: "#78a9d8",
  pink: "#d78aaa",
  red: "#c87862",
  white: "#f1e9d2",
} as const;
