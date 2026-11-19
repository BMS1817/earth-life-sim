import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILY_EVENTS } from "../src/content/family-events.ts";
import { EVENTS } from "../src/content/events.ts";
import { canRegisterMarriage } from "../src/content/partnership-law.ts";
import { detectPatterns } from "../src/content/patterns.ts";
import { advancePeople, remember } from "../src/core/people.ts";
import { applyChoice, pickFamilyEvent, riskChance } from "../src/core/turn.ts";
import type { MortData } from "../src/core/types.ts";
import { names, newState } from "./helpers.ts";

function familyEvent(id: string) {
  return FAMILY_EVENTS.find((e) => e.id === id)!;
}

describe("семейные сцены", () => {
  it("дополнительная сцена не чаще одной за три года, повтор события — не чаще одной за восемь лет", () => {
    const { s } = newState("family-interval");
    s.age = 10;
    const event = pickFamilyEvent(s, FAMILY_EVENTS);
    expect(event).not.toBeNull();
    applyChoice(s, event!, 0, names);
    expect(pickFamilyEvent(s, FAMILY_EVENTS)).toBeNull();
    s.age += 2;
    expect(pickFamilyEvent(s, FAMILY_EVENTS)).toBeNull();
    s.age += 8;
    expect(pickFamilyEvent(s, FAMILY_EVENTS)).not.toBeNull();
  });

  it("слабые отношения дают кризису приоритет", () => {
    const { s } = newState("family-priority");
    s.age = 30;
    applyChoice(s, familyEvent("family-partner-new"), 0, names);
    const partner = s.people.find((p) => p.role === "partner")!;
    partner.initialRelationship = 20;
    for (const parent of s.people.filter((p) => p.role === "mother" || p.role === "father")) parent.initialRelationship = 100;
    s.lastFamilySceneAge = null;
    expect(pickFamilyEvent(s, FAMILY_EVENTS)?.id).toBe("family-partner-crisis");
  });

  it("ребёнок появляется только после выбора и не больше трёх", () => {
    const { s } = newState("children-limit");
    s.age = 24;
    applyChoice(s, EVENTS.find((e) => e.id === "youth-relations")!, 0, names);
    expect(s.people.filter((p) => p.role === "child")).toHaveLength(0);
    const event = EVENTS.find((e) => e.id === "youth-child")!;
    applyChoice(s, event, 1, names);
    expect(s.people.filter((p) => p.role === "child")).toHaveLength(0);
    for (let i = 0; i < 5; i++) applyChoice(s, event, 0, names);
    expect(s.people.filter((p) => p.role === "child")).toHaveLength(3);
  });

  it("характер меняет риск через преимущество или помеху", () => {
    const { s } = newState("trait-risk");
    s.age = 30;
    applyChoice(s, familyEvent("family-partner-new"), 0, names);
    const partner = s.people.find((p) => p.role === "partner")!;
    const event = familyEvent("family-partner-crisis");
    partner.traits = ["warm"];
    expect(riskChance(s, event, event.choices[0])).toBe(0.75);
    partner.traits = ["stubborn"];
    expect(riskChance(s, event, event.choices[0])).toBe(0.25);
  });

  it("после предупреждения и дальнейшего охлаждения партнёр может уйти", () => {
    const { s, family } = newState("departure");
    s.age = 30;
    applyChoice(s, familyEvent("family-partner-new"), 0, names);
    const partner = s.people.find((p) => p.role === "partner")!;
    partner.traits = ["reserved"];
    partner.initialRelationship = 20;
    remember(partner, s.age, s.birth.year + s.age, "family-partner-crisis", "Кризис", -5, "conflict");
    const mort: MortData = JSON.parse(readFileSync(`public/data/mort/${s.birth.country.iso3}.json`, "utf-8"));
    advancePeople(s.seed, s.birth, names, { ...family, tfr: family.tfr.map(() => 0) }, s.people, mort, s.birth.year + s.age);
    expect(partner.status).toBe("ended");
  });

  it("узор трёх детей появляется один раз", () => {
    const { s } = newState("pattern-children");
    s.age = 24;
    applyChoice(s, EVENTS.find((e) => e.id === "youth-relations")!, 0, names);
    const event = EVENTS.find((e) => e.id === "youth-child")!;
    for (let i = 0; i < 3; i++) applyChoice(s, event, 0, names);
    expect(detectPatterns(s).some((text) => text.includes("трое детей"))).toBe(true);
    expect(detectPatterns(s).some((text) => text.includes("трое детей"))).toBe(false);
  });
});

describe("законы регистрации брака", () => {
  it("учитывает страну, год и отмену закона", () => {
    expect(canRegisterMarriage("NLD", 2000, true)).toBe(false);
    expect(canRegisterMarriage("NLD", 2001, true)).toBe(true);
    expect(canRegisterMarriage("USA", 2014, true)).toBe(false);
    expect(canRegisterMarriage("USA", 2015, true)).toBe(true);
    expect(canRegisterMarriage("BMU", 2022, true)).toBe(false);
    expect(canRegisterMarriage("RUS", 2025, true)).toBe(false);
    expect(canRegisterMarriage("RUS", 1950, false)).toBe(true);
  });
});


describe("регрессии семейного QA", () => {
  it("обычный кризис не считается предупреждением о разрыве", () => {
    const { s, family } = newState("job-not-warning");
    s.age = 30;
    applyChoice(s, familyEvent("family-partner-new"), 0, names);
    const partner = s.people.find((p) => p.role === "partner")!;
    partner.traits = ["reserved"];
    partner.initialRelationship = 20;
    remember(partner, s.age, s.birth.year + s.age, "job-crisis", "Рабочий кризис", -5, "conflict");
    const mort: MortData = JSON.parse(readFileSync(`public/data/mort/${s.birth.country.iso3}.json`, "utf-8"));
    advancePeople(s.seed, s.birth, names, { ...family, tfr: family.tfr.map(() => 0) }, s.people, mort, s.birth.year + s.age);
    expect(partner.status).toBe("active");
  });

  it("отложенная свадьба не помечается навсегда пройденной", () => {
    const { s } = newState("marriage-later");
    s.age = 23;
    applyChoice(s, EVENTS.find((e) => e.id === "youth-relations")!, 0, names);
    const marriage = EVENTS.find((e) => e.id === "youth-marriage")!;
    applyChoice(s, marriage, 1, names);
    expect(s.spouseId).toBeNull();
    expect(marriage.once).not.toBe(true);
    expect(marriage.maxAge).toBe(65);
    expect(s.usedEventIds).not.toContain("youth-marriage");
  });

  it("переезды других людей не создают узор героя", () => {
    const { s } = newState("pattern-source");
    for (let i = 0; i < 3; i++) s.chronicle.push({ age: 20 + i, year: 2000 + i, text: "Переезд близкого", source: "people" });
    expect(detectPatterns(s)).not.toContain("Узор жизни: уже третий переезд — новые места стали частью твоей истории.");
    s.chronicle.push({ age: 24, year: 2004, text: "Ты переехал", source: "hero" });
    s.chronicle.push({ age: 25, year: 2005, text: "Ты переехал", source: "hero" });
    s.chronicle.push({ age: 26, year: 2006, text: "Ты переехал", source: "hero" });
    expect(detectPatterns(s)).toContain("Узор жизни: уже третий переезд — новые места стали частью твоей истории.");
  });
});
