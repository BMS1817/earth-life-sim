import { describe, expect, it } from "vitest";
import { advanceTimeTick } from "../src/core/time.ts";
import { addHobby, completeFocusYear, setActiveHobby, setFocus } from "../src/core/focus.ts";
import { TICKS_PER_YEAR } from "../src/content/focus.ts";
import { names, newState } from "./helpers.ts";

function ticks(s: ReturnType<typeof newState>["s"], mort: ReturnType<typeof newState>["mort"], family: ReturnType<typeof newState>["family"], count: number): void {
  for (let i = 0; i < count; i++) advanceTimeTick(s, mort, family, names);
}

describe("время, фокус и хобби", () => {
  it("16 долей завершают ровно один год", () => {
    const { s, mort, family } = newState("time-ticks");
    for (let i = 0; i < TICKS_PER_YEAR - 1; i++) expect(advanceTimeTick(s, mort, family, names)).toBe(false);
    expect(s.age).toBe(0);
    expect(advanceTimeTick(s, mort, family, names)).toBe(true);
    expect(s.age).toBe(1);
    expect(s.time.tick).toBe(0);
    expect(s.happiness).toBeGreaterThan(60);
    expect(s.focus.careerPoints).toBe(0);
  });

  it("смена фокуса действует только на фактическую долю года", () => {
    const { s, mort, family } = newState("focus-fraction");
    s.age = 5;
    setFocus(s, "study");
    ticks(s, mort, family, 8);
    setFocus(s, "relationships");
    ticks(s, mort, family, 8);
    expect(s.scales.education).toBeCloseTo(5.625);
    const closest = s.people.find((p) => p.memories.some((m) => m.eventId === "focus-relationships"));
    expect(closest?.memories.at(-1)?.impact).toBeCloseTo(0.5);
    expect(s.focus.fractions).toEqual({});
  });

  it("счастье ограничено и постепенно возвращается к 60", () => {
    const { s } = newState("happiness-return");
    s.happiness = 90;
    completeFocusYear(s);
    expect(s.happiness).toBeCloseTo(87.18);
    s.happiness = 200;
    completeFocusYear(s);
    expect(s.happiness).toBe(96);
  });

  it("активное хобби растёт и открывает турнир на третьем уровне", () => {
    const { s, mort, family } = newState("hobby-level");
    s.age = 5;
    addHobby(s, "games");
    setActiveHobby(s, "games");
    setFocus(s, "hobby");
    ticks(s, mort, family, TICKS_PER_YEAR * 3);
    expect(s.hobbies[0].level).toBe(3);
    expect(s.hobbies[0].xp).toBeCloseTo(4.5);
    expect(s.chronicle.some((entry) => entry.text.includes("Первый турнир"))).toBe(true);
  });

  it("не больше трёх уникальных хобби", () => {
    const { s } = newState("hobby-limit");
    s.age = 5;
    for (const id of ["games", "games", "sports", "reading", "music"] as const) addHobby(s, id);
    expect(s.hobbies.map((hobby) => hobby.id)).toEqual(["games", "sports", "reading"]);
  });

  it("три года упора на работу повышают профессию", () => {
    const { s, mort, family } = newState("work-focus");
    s.age = 18;
    s.finance.career = "engineering";
    s.finance.careerLevel = 1;
    s.finance.employment = "employed";
    setFocus(s, "work");
    ticks(s, mort, family, TICKS_PER_YEAR * 3);
    expect(s.finance.careerLevel).toBe(2);
    expect(s.scales.health).toBeLessThan(80);
  });
});
