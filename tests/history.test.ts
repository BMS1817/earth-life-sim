import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eraName } from "../src/content/eras.ts";
import { HISTORY } from "../src/content/history.ts";
import { advanceYear, createLifeState, pickYearEvents } from "../src/core/turn.ts";
import { EVENTS } from "../src/content/events.ts";
import type { IndexData, MortData } from "../src/core/types.ts";

const index: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const rus = index.countries.find((c) => c.iso3 === "RUS")!;
const mort: MortData = JSON.parse(readFileSync("public/data/mort/RUS.json", "utf-8"));

describe("исторические эпохи", () => {
  it("эпохи меняются по годам", () => {
    expect(eraName("KAZ", 1980, "Казахстан")).toBe("Казахская ССР, СССР");
    expect(eraName("KAZ", 2000, "Казахстан")).toBe("Казахстан");
    expect(eraName("DEU", 1985, "Германия")).toBe("ФРГ и ГДР");
    expect(eraName("DEU", 1995, "Германия")).toBe("Германия");
    expect(eraName("MMR", 1980, "Мьянма")).toBe("Бирма");
    expect(eraName("SSD", 2005, "Южный Судан")).toBe("Южный Судан, Судан");
    expect(eraName("SSD", 2015, "Южный Судан")).toBe("Южный Судан");
    expect(eraName("BRA", 1970, "Бразилия")).toBe("Бразилия");
  });
});

describe("историческая летопись и кризисы", () => {
  it("мировые события попадают в летопись своего года", () => {
    const s = createLifeState("hist-test", { year: 1960, country: rus, sex: "M", name: "Тест" }, 5000);
    advanceYear(s, mort);
    expect(s.chronicle.some((e) => e.year === 1961 && e.text.includes("Гагарин"))).toBe(true);
  });

  it("кризис распада СССР доступен в 1991 в республиках и только один раз", () => {
    const s = createLifeState("crisis-test", { year: 1960, country: rus, sex: "M", name: "Тест" }, 5000);
    s.age = 31;
    const events = pickYearEvents(s, EVENTS);
    expect(events.some((e) => e.id === "crisis-1991-RUS")).toBe(true);
    s.usedEventIds.push("crisis-1991-RUS");
    expect(pickYearEvents(s, EVENTS).some((e) => e.id === "crisis-1991-RUS")).toBe(false);
    s.usedEventIds = [];
    s.age = 32;
    expect(pickYearEvents(s, EVENTS).some((e) => e.id === "crisis-1991-RUS")).toBe(false);
  });

  it("в каталоге есть события для всех десятилетий 1950–2026", () => {
    for (let decade = 1950; decade <= 2020; decade += 10) {
      expect(HISTORY.some((h) => h.year >= decade && h.year < decade + 10)).toBe(true);
    }
  });
});
