import { lifePattern } from "../core/memorial.ts";
import type { LifeState } from "../core/state.ts";
import { s, t } from "./strings.ts";
import { thematicHeader } from "./thematic-header.ts";

interface LineageViewOptions {
  countryName: string;
  onBack: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(label: string, value: string): HTMLElement {
  const line = el("div", "finance-row");
  line.append(el("span", undefined, label), el("strong", undefined, value));
  return line;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", undefined, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

export function lineageView(state: LifeState, options: LineageViewOptions): HTMLElement {
  const root = el("div", "lineage-view");
  root.append(el("h1", undefined, s.lineageTitle), thematicHeader("lineage"));
  root.append(el("p", "meta", `${state.birth.name} · ${options.countryName}`));

  const current = el("section", "finance-section lineage-current");
  const pattern = lifePattern(state);
  current.style.setProperty("--life-color", pattern.color);
  current.append(el("h2", undefined, s.lineageCurrent));
  current.append(row(s.lineageGeneration(state.lineage.generation), state.birth.name));
  current.append(row(s.lineageCountry, options.countryName));
  current.append(row(s.traitsTitle, state.lineage.heroTraits.map((trait) => s.traits[trait]).join(", ")));
  current.append(row(s.memorialPattern, `${s.patternNames[pattern.name]} · ${pattern.color.toUpperCase()}`));
  root.append(current);

  const ancestors = el("section", "lineage-ancestors");
  state.lineage.ancestors.forEach((ancestor, index) => {
    const card = el("article", "lineage-card");
    card.style.setProperty("--life-color", ancestor.patternColor);
    card.append(el("div", "event-kicker", `${s.lineageAncestor} · ${s.lineageGeneration(index + 1)}`));
    card.append(el("h2", undefined, ancestor.name));
    card.append(el("p", "meta", `${s.lineageYears(ancestor.birthYear, ancestor.deathYear)} · ${s.patternNames[ancestor.patternName]}`));
    if (ancestor.moments.length > 0) {
      card.append(el("h3", undefined, s.lineageMoments));
      const list = el("ol", "lineage-moments");
      for (const moment of ancestor.moments) {
        const item = el("li");
        item.append(el("span", "memory-meta", s.memoryYear(moment.age, moment.year)), el("span", undefined, t(moment.text)));
        list.append(item);
      }
      card.append(list);
    } else card.append(el("p", "muted", s.lineageNoMoments));
    ancestors.append(card);
  });
  root.append(ancestors);

  const inheritance = el("section", "finance-section lineage-inheritance");
  const report = state.lineage.lastInheritance;
  inheritance.append(el("h2", undefined, s.lineageReportTitle));
  if (!report) inheritance.append(el("p", "muted", s.lineageNoInheritance));
  else {
    inheritance.append(el("p", "notice", `${report.parentName} → ${report.heirName} · ${report.year}`));
    inheritance.append(row(s.lineageChildren(report.childrenCount), ""));
    inheritance.append(row(s.lineageCash, s.money(report.cashShare)));
    inheritance.append(row(s.lineageBonds, s.money(report.bondsShare)));
    inheritance.append(row(s.lineageRisky, s.money(report.riskyShare)));
    inheritance.append(row(s.lineageInsurance, s.money(report.insurance)));
    inheritance.append(row(s.lineageRentals(report.rentals), s.lineageBusiness(report.business)));
    inheritance.append(row(s.lineageEducation(report.education), `${s.lineageTrait}: ${s.traits[report.trait]}`));
  }
  root.append(inheritance);
  return root;
}
