import { describe, expect, it } from "vitest";
import { adoptPet, buyProperty, buyRental, startBusiness } from "../src/core/lifestyle.ts";
import { advanceYear } from "../src/core/turn.ts";
import { names, newState } from "./helpers.ts";

describe("образ жизни и имущество", () => {
  it("не больше двух питомцев, возраст и нейтральная смерть", () => {
    const { s, mort, family } = newState("pets-life");
    s.age = 5;
    expect(adoptPet(s, "dog")).toBe(true);
    expect(adoptPet(s, "cat")).toBe(true);
    expect(adoptPet(s, "small")).toBe(false);
    s.pets[0].lifespan = 0;
    advanceYear(s, mort, family, names);
    expect(s.pets[0].deathYear).not.toBeNull();
    expect(s.chronicle.some((entry) => entry.text.includes("ушёл из жизни"))).toBe(true);
    expect(s.finance.lastBreakdown.lifestyle).toBeLessThan(0);
  });

  it("покупка списывается один раз, компьютер помогает учиться", () => {
    const { s, mort, family } = newState("property-computer");
    s.age = 18;
    s.finance.cash = 100_000;
    const education = s.scales.education;
    expect(buyProperty(s, "computer")).toBe(true);
    expect(buyProperty(s, "computer")).toBe(false);
    advanceYear(s, mort, family, names);
    expect(s.scales.education).toBe(education + 1);
    expect(s.property.acquired.computer).toBe(s.birth.year + 18);
  });

  it("своё жильё меняет статус жилья", () => {
    const { s } = newState("property-home");
    s.age = 18;
    s.finance.cash = 100_000;
    expect(buyProperty(s, "home")).toBe(true);
    expect(s.finance.housing).toBe("owned");
  });

  it("автотраты не создают долг", () => {
    const { s, mort, family } = newState("auto-guard");
    s.age = 18;
    s.finance.cash = 0;
    s.lifestyle.autoHealth = true;
    s.lifestyle.autoGifts = true;
    advanceYear(s, mort, family, names);
    expect(s.finance.lastBreakdown.lifestyle).toBe(0);
    expect(s.people.every((p) => p.memories.every((m) => m.eventId !== "auto-gifts"))).toBe(true);
  });

  it("аренда ограничена тремя объектами и имеет обслуживание", () => {
    const { s, mort, family } = newState("rental-limit");
    s.age = 18;
    s.finance.cash = 1_000_000;
    expect(buyRental(s)).toBe(true);
    expect(buyRental(s)).toBe(true);
    expect(buyRental(s)).toBe(true);
    expect(buyRental(s)).toBe(false);
    advanceYear(s, mort, family, names);
    expect(s.finance.lastBreakdown.lifestyle).toBeLessThan(0);
    expect(Number.isFinite(s.finance.lastBreakdown.rentals)).toBe(true);
  });

  it("бизнес не гарантирует прибыль и остаётся в одном экземпляре", () => {
    const { s, mort, family } = newState("business-model");
    s.age = 18;
    s.finance.cash = 1_000_000;
    expect(startBusiness(s, "cafe")).toBe(true);
    expect(startBusiness(s, "shop")).toBe(false);
    advanceYear(s, mort, family, names);
    expect(Number.isFinite(s.finance.lastBreakdown.business)).toBe(true);
    expect(s.property.business === null || s.property.business.kind === "cafe").toBe(true);
  });
});
