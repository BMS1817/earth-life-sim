import type { LifeState } from "../core/state.ts";
import { incomeForYear, netWorth } from "../core/finance.ts";
import type { InvestmentKind } from "../core/finance.ts";
import { s } from "./strings.ts";
import { thematicHeader } from "./thematic-header.ts";

interface FinanceViewOptions {
  onBack: () => void;
  onInvest: (kind: InvestmentKind, buy: boolean) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", undefined, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function row(label: string, value: string): HTMLElement {
  const line = el("div", "finance-row");
  line.append(el("span", undefined, label), el("strong", undefined, value));
  return line;
}

export function financeView(state: LifeState, options: FinanceViewOptions): HTMLElement {
  const f = state.finance;
  const year = state.birth.year + state.age;
  const root = el("div", "finance-view");
  root.append(el("h1", undefined, s.financeTitle), thematicHeader("finance"));
  root.append(el("p", "people-source", s.financeSource));

  const work = el("section", "finance-section");
  work.append(el("h2", undefined, s.financeWork));
  work.append(row(s.financeCareer, f.career ? s.careers[f.career] : s.financeNoCareer));
  work.append(row(s.financeEmployment, s.employment[f.employment]));
  work.append(row(s.financeCareerLevel, String(f.careerLevel)));
  work.append(row(s.financeIncomeYear, s.money(incomeForYear(f, year))));
  root.append(work);

  const balance = el("section", "finance-section");
  balance.append(el("h2", undefined, s.financeBalance));
  balance.append(row(s.financeCash, s.money(f.cash)));
  balance.append(row(s.financeNetWorth, s.money(netWorth(f))));
  balance.append(row(s.financeNetYear, s.money(f.lastYearNet)));
  balance.append(row(s.financeHousing, s.housing[f.housing]));
  if (f.housing === "mortgage") balance.append(row(s.financeHousing, s.financeMortgageLeft(f.mortgageYearsLeft)));
  root.append(balance);

  const breakdown = el("section", "finance-section");
  breakdown.append(el("h2", undefined, s.breakdownTitle));
  for (const kind of Object.keys(s.breakdown) as (keyof typeof s.breakdown)[]) {
    breakdown.append(row(s.breakdown[kind], s.money(f.lastBreakdown[kind])));
  }
  root.append(breakdown);

  const investments = el("section", "finance-section");
  investments.append(el("h2", undefined, s.financeInvestments));
  investments.append(el("p", "muted", s.financeOneDeal));
  for (const kind of ["bonds", "risky"] as InvestmentKind[]) {
    investments.append(row(kind === "bonds" ? s.financeBonds : s.financeRisky, s.money(f[kind])));
    const buy = button(s.financeBuy, () => options.onInvest(kind, true));
    buy.disabled = f.lastInvestmentYear === year || f.cash < 100;
    const sell = button(s.financeSell, () => options.onInvest(kind, false));
    sell.disabled = f.lastInvestmentYear === year || f[kind] < 100;
    const actions = el("div", "finance-actions");
    actions.append(buy, sell);
    investments.append(actions);
  }
  if (f.lastRiskyReturn !== null && f.risky > 0) {
    investments.append(row(s.financeRiskyReturn, `${f.lastRiskyReturn >= 0 ? "+" : ""}${Math.round(f.lastRiskyReturn * 100)}%`));
  }
  root.append(investments);
  return root;
}
