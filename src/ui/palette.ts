import type { Climate } from "./scene.ts";

export const SKY: Record<Climate, string> = {
  north: "#d8ecf8",
  temperate: "#7ec0e8",
  tropics: "#a8d8f0",
};

export const GROUND: Record<Climate, string> = {
  north: "#e8eef2",
  temperate: "#6a9a5b",
  tropics: "#d8c08a",
};
