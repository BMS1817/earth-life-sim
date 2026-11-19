import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { climateForCountry, houseForMoney, personVariant, stageForAge, warVisualMode } from "../src/ui/scene.ts";
import { newState } from "./helpers.ts";

describe("пиксельная сцена: выбор спрайтов", () => {
  it("возрастные стадии", () => {
    expect(stageForAge(0)).toBe("infant");
    expect(stageForAge(6)).toBe("early");
    expect(stageForAge(12)).toBe("child");
    expect(stageForAge(17)).toBe("teen");
    expect(stageForAge(29)).toBe("young");
    expect(stageForAge(44)).toBe("adult");
    expect(stageForAge(59)).toBe("mature");
    expect(stageForAge(79)).toBe("senior");
    expect(stageForAge(80)).toBe("elder");
  });

  it("дом по доходу", () => {
    expect(houseForMoney(0)).toBe("poor");
    expect(houseForMoney(50)).toBe("mid");
    expect(houseForMoney(100)).toBe("rich");
  });

  it("18 домов имеют свои размеры и помещаются от общего нижнего центра", () => {
    const manifest = JSON.parse(readFileSync("public/art/kimi/manifest.json", "utf-8")) as { houses: Record<string, { size: [number, number]; anchor: [number, number] }> };
    const houses = Object.entries(manifest.houses);
    expect(houses).toHaveLength(18);
    for (const [name, { size, anchor }] of houses) {
      const level = name.split("_")[2] as "poor" | "mid" | "rich";
      expect(size).toEqual({ poor: [80, 64], mid: [96, 80], rich: [112, 96] }[level]);
      expect(anchor).toEqual([56, 176]);
      expect(anchor[0] - size[0] / 2).toBeGreaterThanOrEqual(0);
      expect(anchor[0] + size[0] / 2).toBeLessThanOrEqual(256);
      expect(anchor[1] - size[1]).toBeGreaterThanOrEqual(0);
      expect(anchor[1]).toBeLessThanOrEqual(192);
    }
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
    expect(warVisualMode(s)).toBe("off");
  });
});
