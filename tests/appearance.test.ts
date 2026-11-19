import { describe, expect, it } from "vitest";
import { ageStageForAge, appearanceForSeed } from "../src/ui/appearance.ts";

describe("modular appearance", () => {
  it("covers all nine age boundaries", () => {
    const ages = [0, 2, 3, 6, 7, 12, 13, 17, 18, 29, 30, 44, 45, 59, 60, 79, 80, 100];
    expect(ages.map(ageStageForAge)).toEqual([
      "infant", "infant", "early", "early", "child", "child", "teen", "teen", "young",
      "young", "adult", "adult", "mature", "mature", "senior", "senior", "elder", "elder",
    ]);
  });

  it("is deterministic and covers every independent module", () => {
    expect(appearanceForSeed("same-seed", "F")).toEqual(appearanceForSeed("same-seed", "F"));
    const faces = new Set<number>();
    const bodies = new Set<number>();
    const tones = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const appearance = appearanceForSeed(`person-${i}`, i % 2 === 0 ? "F" : "M");
      faces.add(appearance.face);
      bodies.add(appearance.body);
      tones.add(appearance.skin);
    }
    expect([...faces].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...bodies].sort()).toEqual([0, 1, 2]);
    expect([...tones].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("changes only the presentation when sex changes", () => {
    const female = appearanceForSeed("same-seed", "F");
    const male = appearanceForSeed("same-seed", "M");
    expect(male).toEqual({ ...female, sex: "M" });
  });
});
