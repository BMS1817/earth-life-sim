import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alternativeGdp, alternativeMortality, campaignCost, canRunForOffice, createPoliticsState, electionChance, holdReferendum, nextElectionYear, politicsYear, processPoliticsYear, startCampaign, attemptUsurpation } from "../src/core/politics.ts";
import type { PoliticsData } from "../src/core/politics.ts";
import { newState } from "./helpers.ts";

function profile(iso3: string): PoliticsData {
  return JSON.parse(readFileSync(`public/data/politics/${iso3}.json`, "utf-8"));
}

function nationalOffice(seed: string) {
  const { s, politics } = newState(seed);
  s.age = 40;
  s.finance.cash = 100000;
  s.politics.career.status = "inOffice";
  s.politics.career.level = "national";
  s.politics.career.lastLevel = "national";
  s.politics.career.support = 60;
  s.politics.career.termStartYear = s.birth.year + s.age;
  s.politics.career.termEndYear = s.birth.year + s.age + 4;
  return { s, politics };
}

describe("политическая карьера и конституция", () => {
  it("использует фактические национальные выборы и продолжает цикл после наблюдений", () => {
    const usa = profile("USA");
    const constitution = politicsYear(usa, 2020).constitution;
    expect(nextElectionYear(usa, "national", constitution, 2020)).toBe(2024);
    expect(nextElectionYear(usa, "national", constitution, 2025)).toBe(2028);
    expect(nextElectionYear(usa, "local", constitution, 2020)).toBe(2024);
    expect(nextElectionYear(profile("BRN"), "national", politicsYear(profile("BRN"), 2020).constitution, 2020)).toBeNull();
  });

  it("проводит годовую подготовку, списывает кампанию один раз и проверяет лестницу", () => {
    const { s, politics } = newState("politics-campaign");
    s.age = 18;
    s.finance.cash = 100000;
    expect(canRunForOffice(s, "local")).toBe(false);
    s.politics.trainingComplete = true;
    expect(canRunForOffice(s, "regional")).toBe(false);
    const before = s.finance.cash;
    expect(startCampaign(s, politics, "local", "community")).toBe(true);
    expect(s.finance.cash).toBeCloseTo(before - campaignCost(s, "local"));
    expect(startCampaign(s, politics, "local", "market")).toBe(false);
    expect(s.politics.career.nextElectionYear).toBe(s.birth.year + s.age + 4);
    expect(electionChance(s, politics)).toBeGreaterThan(0);
    s.politics.career.status = "none";
    s.politics.career.experience.local = 2;
    expect(canRunForOffice(s, "regional")).toBe(true);
    s.politics.career.experience.regional = 3;
    s.scales.education = 40;
    expect(canRunForOffice(s, "national")).toBe(true);
  });

  it("даёт детерминированный результат выборов и завершает срок", () => {
    const { s, politics } = newState("politics-election");
    s.age = 18;
    s.finance.cash = 100000;
    s.politics.trainingComplete = true;
    startCampaign(s, politics, "local", "welfare");
    const electionYear = s.politics.career.nextElectionYear!;
    const snapshot = structuredClone(s);
    s.age = electionYear - s.birth.year;
    processPoliticsYear(s, politics, electionYear);
    const restored = structuredClone(snapshot);
    processPoliticsYear(restored, politics, electionYear);
    expect(restored.politics.career).toEqual(s.politics.career);
    expect(["none", "inOffice"]).toContain(s.politics.career.status);
    if (s.politics.career.status === "inOffice") {
      s.age = s.politics.career.termEndYear! - s.birth.year;
      processPoliticsYear(s, politics, s.birth.year + s.age);
      expect(s.politics.career.status).toBe("none");
      expect(s.politics.career.lastLevel).toBe("local");
    }
  });

  it("не позволяет две поправки за срок и применяет эффект только после лага", () => {
    let accepted: ReturnType<typeof nationalOffice> | null = null;
    for (let index = 0; index < 30 && !accepted; index++) {
      const candidate = nationalOffice(`politics-referendum-${index}`);
      if (holdReferendum(candidate.s, candidate.politics, "termLimit", 3)) accepted = candidate;
    }
    expect(accepted).not.toBeNull();
    const { s, politics } = accepted!;
    expect(s.politics.career.amendmentUsed).toBe(true);
    expect(holdReferendum(s, politics, "judiciary", false)).toBe(false);
    expect(s.politics.alternative.pending).toHaveLength(1);
    const year = s.birth.year + s.age;
    const before = alternativeMortality(s);
    processPoliticsYear(s, politics, year + 2);
    expect(alternativeMortality(s)).toBe(before);
    processPoliticsYear(s, politics, year + 3);
    expect(alternativeMortality(s)).not.toBe(before);
    expect(alternativeGdp(s, 1000)).toBeCloseTo(1000 * s.politics.alternative.gdpFactor);
  });

  it("блокирует превышение предела переизбраний", () => {
    const { s, politics } = nationalOffice("politics-term-limit");
    s.politics.trainingComplete = true;
    s.politics.career.status = "none";
    s.politics.career.termsServed = 2;
    s.politics.constitution.termLimit = 2;
    expect(canRunForOffice(s, "national")).toBe(false);
    s.politics.career.lastLevel = "regional";
    s.politics.career.experience.regional = 3;
    s.scales.education = 60;
    expect(canRunForOffice(s, "national")).toBe(true);
    expect(politics.iso3).toBeTruthy();
  });

  it("узурпация имеет исход и противодействие, не бесплатный повтор", () => {
    let attempted: ReturnType<typeof nationalOffice> | null = null;
    for (let index = 0; index < 20 && !attempted; index++) {
      const candidate = nationalOffice(`politics-usurpation-${index}`);
      attemptUsurpation(candidate.s, candidate.politics);
      if (candidate.s.politics.career.amendmentUsed) attempted = candidate;
    }
    expect(attempted).not.toBeNull();
    const { s, politics } = attempted!;
    expect(s.politics.alternative.changes).toHaveLength(1);
    expect(attemptUsurpation(s, politics)).toBe(false);
    if (s.politics.alternative.changes[0].success) {
      expect(s.politics.constitution.legislature).toBe(false);
      expect(s.politics.constitution.judiciary).toBe(false);
      expect(s.politics.alternative.pending).toHaveLength(1);
    } else {
      expect(s.politics.career.status).toBe("none");
      expect(s.politics.alternative.pending).toHaveLength(0);
    }
  });

  it("создаёт независимые исходные и альтернативные ряды", () => {
    const data = profile("USA");
    const state = createPoliticsState(data, 2020);
    expect(state.alternative.gdpFactor).toBe(1);
    expect(state.alternative.mortalityFactor).toBe(1);
    expect(state.constitution).toEqual(politicsYear(data, 2020).constitution);
    expect(data.polyarchy[74]).toBeCloseTo(0.843);
  });
});
