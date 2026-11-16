import { describe, expect, it } from "vitest";
import { climateForCountry, houseForMoney, personVariant, stageForAge, warVisualMode } from "../src/ui/scene.ts";
import { newState } from "./helpers.ts";

describe("пиксельная сцена: выбор спрайтов", () => {
  it("возрастные стадии", () => {
    expect(stageForAge(0)).toBe("child");
    expect(stageForAge(12)).toBe("child");
    expect(stageForAge(13)).toBe("teen");
    expect(stageForAge(19)).toBe("teen");
    expect(stageForAge(20)).toBe("adult");
    expect(stageForAge(59)).toBe("adult");
    expect(stageForAge(60)).toBe("senior");
  });

  it("дом по доходу", () => {
    expect(houseForMoney(0)).toBe("poor");
    expect(houseForMoney(50)).toBe("mid");
    expect(houseForMoney(100)).toBe("rich");
  });

  it("силуэт человека стабилен и покрывает три варианта", () => {
    const variants = new Set(Array.from({ length: 40 }, (_, i) => personVariant(`person-${i}`)));
    expect(variants).toEqual(new Set([0, 1, 2]));
    expect(personVariant("mother-1")).toBe(personVariant("mother-1"));
    expect([0, 1, 2]).toContain(personVariant("mother-1"));
  });

  it("климат по стране", () => {
    expect(climateForCountry("RUS")).toBe("north");
    expect(climateForCountry("BRA")).toBe("tropics");
    expect(climateForCountry("FRA")).toBe("temperate");
  });
});


describe("военная сцена", () => {
  it("показывает солдат только во время конфликта и гражданский вариант при soften", () => {
    const { s } = newState("scene-war");
    expect(warVisualMode(s)).toBe("off");
    s.war.pendingEventId = "war-start";
    expect(warVisualMode(s)).toBe("military");
    s.softenHeavy = true;
    expect(warVisualMode(s)).toBe("civilian");
    s.war.pendingEventId = null;
    s.lastOutcomeKind = "conflict";
    expect(warVisualMode(s)).toBe("civilian");
  });
});
