import { describe, expect, it } from "vitest";
import { buildAlbum, favoriteMoments, finalSceneMoments, giftedDay, lifePattern, mainTurns, roomItems, toggleFavoriteMoment } from "../src/core/memorial.ts";
import { completeFocusYear } from "../src/core/focus.ts";
import { autoPlay, newState } from "./helpers.ts";

function addChronicle(count: number) {
  const { s } = newState(`memorial-${count}`);
  for (let index = 0; index < count; index++) {
    s.chronicle.push({ age: index, year: s.birth.year + index, text: `Поворот ${index}`, source: "hero" });
  }
  return s;
}

describe("локальный мемориал", () => {
  it("хранит начальное и ежегодное счастье, включая смертельный год", () => {
    const s = autoPlay("memorial-history");
    expect(s.happinessHistory).toHaveLength(s.age + 1);
    expect(s.happinessHistory[0]).toEqual({ age: 0, year: s.birth.year, value: 70 });
    expect(s.happinessHistory.at(-1)?.year).toBe(s.deathYear);
    expect(s.happinessHistory.at(-1)?.value).toBe(Math.round(s.happiness * 10) / 10);
    const focusYears = Object.values(s.focusTotals).reduce((sum, value) => sum + value, 0);
    expect(focusYears).toBeCloseTo(s.age + 1, 8);
  });

  it("суммирует доли разных фокусов и очищает только текущий год", () => {
    const { s } = newState("memorial-focus");
    s.focus.fractions = { study: 0.25, rest: 0.75 };
    completeFocusYear(s);
    expect(s.focusTotals.study).toBeCloseTo(0.25);
    expect(s.focusTotals.rest).toBeCloseTo(0.75);
    expect(s.focus.fractions).toEqual({});
    s.focus.fractions = { study: 1 };
    completeFocusYear(s);
    expect(s.focusTotals.study).toBeCloseTo(1.25);
  });

  it("ограничивает избранное 32 уникальными существующими моментами", () => {
    const s = addChronicle(40);
    expect(toggleFavoriteMoment(s, -1)).toBe(false);
    expect(toggleFavoriteMoment(s, 40)).toBe(false);
    for (let index = 0; index < 32; index++) expect(toggleFavoriteMoment(s, index)).toBe(true);
    expect(s.favoriteMomentIndexes).toHaveLength(32);
    expect(new Set(s.favoriteMomentIndexes).size).toBe(32);
    expect(toggleFavoriteMoment(s, 32)).toBe(false);
    expect(toggleFavoriteMoment(s, 0)).toBe(true);
    expect(s.favoriteMomentIndexes).toHaveLength(31);
    expect(toggleFavoriteMoment(s, 32)).toBe(true);
    expect(favoriteMoments(s).at(-1)?.index).toBe(32);
  });

  it("собирает биографию, альбом и последнюю сцену из избранного", () => {
    const s = addChronicle(16);
    s.chronicle.push({ age: 16, year: s.birth.year + 16, text: "Мировая новость", source: "history" });
    for (const index of [2, 5, 8, 11]) toggleFavoriteMoment(s, index);
    expect(mainTurns(s)).toHaveLength(12);
    expect(mainTurns(s).some((moment) => moment.source === "history")).toBe(false);
    const album = buildAlbum(s);
    expect(album).toHaveLength(6);
    for (const index of [2, 5, 8, 11]) expect(album.some((moment) => moment.index === index)).toBe(true);
    expect(finalSceneMoments(s)).toHaveLength(3);
    for (const moment of finalSceneMoments(s)) expect([2, 5, 8, 11]).toContain(moment.index);
  });

  it("детерминированно вычисляет цвет и название по фокусам и компасу", () => {
    const { s } = newState("memorial-pattern");
    s.focusTotals = { study: 4, rest: 1 };
    const first = lifePattern(s);
    expect(lifePattern(s)).toEqual(first);
    expect(first.color).toMatch(/^#[0-9a-f]{6}$/);
    s.focusTotals = { relationships: 5 };
    expect(lifePattern(s).color).not.toBe(first.color);
    s.compass = { tradition: 10, bonds: 10, choices: 10 };
    expect(lifePattern(s).name).toBe("hearthKeeper");
    s.compass = { tradition: -10, bonds: -10, choices: 10 };
    expect(lifePattern(s).name).toBe("freeWanderer");
  });

  it("выводит предметы комнаты из имущества, людей, хобби и дел", () => {
    const { s } = newState("memorial-room");
    s.property.items = ["computer", "bicycle", "car", "home"];
    s.property.rentals = 1;
    s.property.business = { kind: "shop", startedYear: 2020, successfulYears: 2, level: 1 };
    s.pets.push({ id: "cat-0", kind: "cat", name: "Луна", adoptedYear: 2020, deathYear: null, lifespan: 12 });
    s.hobbies.push({ id: "sports", xp: 20, level: 4 });
    s.finance.career = "pilot";
    s.people[0].role = "partner";
    s.people[1].role = "child";
    const items = roomItems(s);
    for (const item of ["computer", "bicycle", "car", "home", "rental", "business", "cat", "hobbySports", "career", "partner", "child"]) {
      expect(items).toContain(item);
    }
    expect(new Set(items).size).toBe(items.length);
  });

  it("выбирает один подаренный день и не меняет прошлое", () => {
    const { s } = newState("memorial-gift");
    s.age = 30;
    s.plan = { kind: "dream", remainingYears: 1, dreamCareer: "pilot" };
    const before = JSON.stringify(s);
    expect(giftedDay(s)).toMatchObject({ kind: "career", career: "pilot" });
    expect(JSON.stringify(s)).toBe(before);
    s.plan = null;
    s.hobbies.push({ id: "music", xp: 10, level: 3 });
    const hobbyBefore = JSON.stringify(s);
    expect(giftedDay(s)).toMatchObject({ kind: "hobby", hobby: "music" });
    expect(JSON.stringify(s)).toBe(hobbyBefore);
  });
});
