import { ALBUM_LIMIT, BIOGRAPHY_LIMIT, DREAM_CAREERS, FINAL_SCENE_LIMIT, FOCUS_HUES, MAX_FAVORITE_MOMENTS } from "../content/memorial.ts";
import type { CareerId } from "./finance.ts";
import { compassPosition } from "./state.ts";
import type { ChronicleEntry, FocusId, HobbyId, LifeState, PropertyItemId } from "./state.ts";

export interface MemorialMoment extends ChronicleEntry {
  index: number;
}

export type PatternName =
  | "hearthKeeper" | "steadyPath" | "lonelyOrder"
  | "warmCircle" | "ownConstellation" | "quietOrbit"
  | "freeFellowship" | "pathfinder" | "freeWanderer";

export interface LifePattern {
  color: string;
  hue: number;
  saturation: number;
  lightness: number;
  name: PatternName;
  dominantFocus: FocusId;
}

export type RoomItemKind =
  | PropertyItemId | "dog" | "cat" | "small"
  | "hobbyGames" | "hobbySports" | "hobbyReading" | "hobbyMusic" | "hobbyCrafts" | "hobbyNature"
  | "career" | "partner" | "child" | "business" | "rental";

export interface GiftedDay {
  kind: "career" | "hobby" | "focus";
  career: CareerId | null;
  hobby: HobbyId | null;
  focus: FocusId;
  age: number;
}

export function recordHappiness(s: LifeState): void {
  const point = { age: s.age, year: s.birth.year + s.age, value: Math.round(s.happiness * 10) / 10 };
  const last = s.happinessHistory.at(-1);
  if (last?.age === point.age && last.year === point.year) s.happinessHistory[s.happinessHistory.length - 1] = point;
  else s.happinessHistory.push(point);
}

export function toggleFavoriteMoment(s: LifeState, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= s.chronicle.length) return false;
  const existing = s.favoriteMomentIndexes.indexOf(index);
  if (existing >= 0) {
    s.favoriteMomentIndexes.splice(existing, 1);
    return true;
  }
  if (s.favoriteMomentIndexes.length >= MAX_FAVORITE_MOMENTS) return false;
  s.favoriteMomentIndexes.push(index);
  s.favoriteMomentIndexes.sort((a, b) => a - b);
  return true;
}

export function favoriteMoments(s: LifeState): MemorialMoment[] {
  return s.favoriteMomentIndexes
    .filter((index, position, all) => Number.isInteger(index) && index >= 0 && index < s.chronicle.length && all.indexOf(index) === position)
    .sort((a, b) => a - b)
    .map((index) => ({ ...s.chronicle[index], index }));
}

function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  return Array.from({ length: limit }, (_, position) => items[Math.round(position * (items.length - 1) / (limit - 1))]);
}

export function mainTurns(s: LifeState, limit = BIOGRAPHY_LIMIT): MemorialMoment[] {
  const seen = new Set<string>();
  const turns = s.chronicle.flatMap((entry, index) => {
    if (entry.source !== "hero" && entry.source !== "people") return [];
    const key = `${entry.age}:${entry.text}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...entry, index }];
  });
  return sampleEvenly(turns, limit);
}

export function buildAlbum(s: LifeState): MemorialMoment[] {
  const favorites = favoriteMoments(s);
  const selected = sampleEvenly(favorites, ALBUM_LIMIT);
  const selectedIndexes = new Set(selected.map((moment) => moment.index));
  for (const moment of mainTurns(s)) {
    if (selected.length >= ALBUM_LIMIT) break;
    if (!selectedIndexes.has(moment.index)) {
      selected.push(moment);
      selectedIndexes.add(moment.index);
    }
  }
  return selected.sort((a, b) => a.year - b.year || a.index - b.index).slice(0, ALBUM_LIMIT);
}

export function finalSceneMoments(s: LifeState): MemorialMoment[] {
  const favorites = favoriteMoments(s);
  if (favorites.length > 0) return sampleEvenly(favorites, FINAL_SCENE_LIMIT);
  return mainTurns(s, s.chronicle.length).slice(-FINAL_SCENE_LIMIT);
}

const HOBBY_ROOM_ITEMS: Record<HobbyId, RoomItemKind> = {
  games: "hobbyGames",
  sports: "hobbySports",
  reading: "hobbyReading",
  music: "hobbyMusic",
  crafts: "hobbyCrafts",
  nature: "hobbyNature",
};

export function roomItems(s: LifeState): RoomItemKind[] {
  const items: RoomItemKind[] = [...s.property.items];
  for (const pet of s.pets) items.push(pet.kind);
  for (const hobby of s.hobbies) items.push(HOBBY_ROOM_ITEMS[hobby.id]);
  if (s.finance.career) items.push("career");
  if (s.people.some((person) => person.role === "partner")) items.push("partner");
  if (s.people.some((person) => person.role === "child")) items.push("child");
  if (s.property.business) items.push("business");
  if (s.property.rentals > 0) items.push("rental");
  return [...new Set(items)];
}

export function dominantFocus(s: LifeState): FocusId {
  const entries = Object.entries(s.focusTotals) as [FocusId, number][];
  if (entries.length === 0) return s.focus.current;
  return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function hslHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const sat = saturation / 100;
  const light = lightness / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  const m = light - chroma / 2;
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function lifePattern(s: LifeState): LifePattern {
  const tradition = compassPosition(s.compass.tradition, s.compass.choices);
  const bonds = compassPosition(s.compass.bonds, s.compass.choices);
  const entries = Object.entries(s.focusTotals).filter(([, value]) => value > 0) as [FocusId, number][];
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const vector = entries.reduce((sum, [id, value]) => {
    const angle = FOCUS_HUES[id] * Math.PI / 180;
    return { x: sum.x + Math.cos(angle) * value, y: sum.y + Math.sin(angle) * value };
  }, { x: 0, y: 0 });
  const focusHue = total > 0 && (vector.x !== 0 || vector.y !== 0)
    ? Math.atan2(vector.y, vector.x) * 180 / Math.PI
    : FOCUS_HUES[s.focus.current];
  const hue = Math.round((focusHue + tradition * 24 + bonds * 16 + 360) % 360);
  const saturation = 58 + Math.round(Math.abs(bonds) * 18);
  const lightness = 52 + Math.round(tradition * 6);
  const vertical = tradition >= 0.2 ? 0 : tradition <= -0.2 ? 2 : 1;
  const horizontal = bonds >= 0.2 ? 0 : bonds <= -0.2 ? 2 : 1;
  const names: PatternName[][] = [
    ["hearthKeeper", "steadyPath", "lonelyOrder"],
    ["warmCircle", "ownConstellation", "quietOrbit"],
    ["freeFellowship", "pathfinder", "freeWanderer"],
  ];
  return { color: hslHex(hue, saturation, lightness), hue, saturation, lightness, name: names[vertical][horizontal], dominantFocus: dominantFocus(s) };
}

export function giftedDay(s: LifeState): GiftedDay {
  const focus = dominantFocus(s);
  const base = { focus, age: Math.max(5, s.age) };
  if (s.age >= 18 && s.plan?.kind === "dream" && s.plan.dreamCareer && s.plan.dreamCareer !== s.finance.career) {
    return { ...base, kind: "career", career: s.plan.dreamCareer, hobby: null };
  }
  const hobby = [...s.hobbies].filter((item) => item.level < 10).sort((a, b) => b.level - a.level || a.id.localeCompare(b.id))[0];
  if (hobby) return { ...base, kind: "hobby", career: null, hobby: hobby.id };
  if (s.age >= 18 && !s.finance.career) return { ...base, kind: "career", career: DREAM_CAREERS[focus], hobby: null };
  if (s.age >= 5 && s.hobbies.length === 0) {
    const hobbies: Record<FocusId, HobbyId> = { balance: "nature", study: "reading", relationships: "music", health: "sports", hobby: "games", work: "crafts", growth: "reading", rest: "nature" };
    return { ...base, kind: "hobby", career: null, hobby: hobbies[focus] };
  }
  return { ...base, kind: "focus", career: null, hobby: null };
}
