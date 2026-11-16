import { describe, expect, it } from "vitest";
import { applyMoneyEvent, createFinance, expensesForYear, incomeForYear, invest, divest, migrateFinance, netWorth, processFinanceYear } from "../src/core/finance.ts";
import { newState } from "./helpers.ts";

describe("доход и расходы", () => {
  it("профессия, стаж и налоги вычисляют годовой доход", () => {
    const f = createFinance(10000);
    f.career = "medicine";
    f.education = 100;
    f.careerStartYear = 2000;
    f.employment = "employed";
    expect(incomeForYear(f, 2020)).toBeCloseTo(13440, 6);
  });

  it("пенсия продолжает доход после 65", () => {
    const { s } = newState("finance-retired");
    s.finance.career = "medicine";
    s.finance.careerStartYear = 1950;
    s.finance.employment = "employed";
    s.finance.cash = 1000;
    s.age = 65;
    processFinanceYear(s, 2015);
    expect(s.finance.employment).toBe("retired");
    expect(s.finance.lastYearNet).not.toBe(0);
  });

  it("жильё и семья влияют на расходы", () => {
    const f = createFinance(10000);
    f.housing = "rent";
    expect(expensesForYear(f, 30, 2, true)).toBeCloseTo(6300, 6);
    f.housing = "parents";
    expect(expensesForYear(f, 30, 0, false)).toBeCloseTo(3700, 6);
    expect(expensesForYear(f, 10, 3, true)).toBe(0);
  });
});

describe("долг и активы", () => {
  it("долг ограничен годовым доходом", () => {
    const f = createFinance(10000);
    f.career = "industry";
    f.careerStartYear = 2000;
    f.employment = "employed";
    f.cash = -50000;
    applyMoneyEvent(f, 0, 2020);
    expect(f.cash).toBe(-7680);
  });

  it("перед долгом продаются облигации и рискованный актив", () => {
    const f = createFinance(10000);
    f.cash = -100;
    f.bonds = 50;
    f.risky = 50;
    applyMoneyEvent(f, 0, 2020);
    expect(f.cash).toBe(0);
    expect(f.bonds).toBe(0);
    expect(f.risky).toBe(0);
    expect(netWorth(f)).toBe(0);
  });

  it("одна сделка в год и никакого кредитного плеча", () => {
    const f = createFinance(10000);
    f.cash = 200;
    expect(invest(f, "risky", 100, 2020)).toBe(true);
    expect(invest(f, "risky", 100, 2020)).toBe(false);
    expect(divest(f, "risky", 100, 2021)).toBe(true);
    expect(f.risky).toBe(0);
    expect(f.cash).toBe(200);
    expect(invest(f, "bonds", 300, 2022)).toBe(false);
  });

  it("рискованный портфель не уходит ниже нуля", () => {
    const { s } = newState("finance-risk");
    s.finance.risky = 100;
    for (let year = 2000; year < 2100; year++) {
      processFinanceYear(s, year);
      expect(s.finance.risky).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("жильё и миграция", () => {
  it("ипотека заканчивается собственностью", () => {
    const { s } = newState("mortgage");
    s.finance.housing = "mortgage";
    s.finance.mortgageYearsLeft = 1;
    processFinanceYear(s, 2000);
    expect(s.finance.housing).toBe("owned");
    expect(s.finance.mortgageYearsLeft).toBe(0);
  });

  it("миграция вычисляет баланс, профессию и занятость", () => {
    const f = migrateFinance(60, 70, 60, 10000, 1950);
    expect(f.cash).toBe(1500);
    expect(f.career).toBe("engineering");
    expect(f.employment).toBe("retired");
    expect(f.housing).toBe("rent");
  });
});
