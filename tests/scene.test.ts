import { describe, expect, it } from "vitest";
import { climateForCountry, houseForMoney, stageForAge } from "../src/ui/scene.ts";

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

  it("климат по стране", () => {
    expect(climateForCountry("RUS")).toBe("north");
    expect(climateForCountry("BRA")).toBe("tropics");
    expect(climateForCountry("FRA")).toBe("temperate");
  });
});
