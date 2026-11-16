import { alternativeGdp, campaignCost, canRunForOffice, nextElectionYear, politicsYear, referendumChance, usurpationChance } from "../core/politics.ts";
import type { AmendmentField, AmendmentValue, PoliticalLevel, PoliticalPlatform, PoliticsData } from "../core/politics.ts";
import type { LifeState } from "../core/state.ts";
import { ru as s } from "./strings.ts";

interface PoliticsViewOptions {
  baseGdp: number;
  onBack: () => void;
  onPlan: () => void;
  onCampaign: (level: PoliticalLevel, platform: PoliticalPlatform) => void;
  onReferendum: (field: AmendmentField, value: AmendmentValue) => void;
  onUsurpation: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", undefined, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function section(title: string, extraClass = ""): HTMLElement {
  const root = el("section", `finance-section politics-section${extraClass ? ` ${extraClass}` : ""}`);
  root.append(el("h2", undefined, title));
  return root;
}

function row(label: string, value: string): HTMLElement {
  const line = el("div", "finance-row");
  line.append(el("span", undefined, label), el("strong", undefined, value));
  return line;
}

function selectNode(label: string): HTMLSelectElement {
  const select = el("select", "hobby-select");
  select.setAttribute("aria-label", label);
  return select;
}

function addOption(select: HTMLSelectElement, value: string, label: string, current: string): void {
  const option = el("option", undefined, label);
  option.value = value;
  option.selected = value === current;
  select.append(option);
}

function valueOptions(field: AmendmentField, state: LifeState): AmendmentValue[] {
  if (field === "form") return Object.keys(s.politicsForms) as AmendmentValue[];
  if (field === "leader") return Object.keys(s.politicsLeaders) as AmendmentValue[];
  if (field === "termYears") return [4, 5, 6, 7];
  if (field === "termLimit") return [0, 1, 2, 3];
  return [true, false].filter((value) => value !== state.politics.constitution[field]);
}

function valueLabel(field: AmendmentField, value: AmendmentValue): string {
  if (field === "form") return s.politicsForms[value as keyof typeof s.politicsForms];
  if (field === "leader") return s.politicsLeaders[value as keyof typeof s.politicsLeaders];
  if (field === "termYears") return s.politicsTermYears(Number(value));
  if (field === "termLimit") return s.politicsTermLimit(Number(value));
  return s.politicsBooleanValue(Boolean(value));
}

function parseValue(field: AmendmentField, raw: string): AmendmentValue {
  if (field === "termYears" || field === "termLimit") return Number(raw);
  if (field === "legislature" || field === "judiciary") return raw === "true";
  return raw;
}

export function politicsView(state: LifeState, data: PoliticsData, options: PoliticsViewOptions): HTMLElement {
  const root = el("div", "politics-view");
  const year = state.birth.year + state.age;
  const profile = politicsYear(data, year);
  const career = state.politics.career;
  root.append(button(s.back, options.onBack));
  root.append(el("h1", undefined, s.politicsTitle));
  root.append(el("p", "meta", `${state.birth.name} · ${year}`));

  const current = section(s.politicsCurrent);
  current.append(row(s.politicsFields.form, s.politicsForms[profile.constitution.form]));
  current.append(row(s.politicsFields.leader, s.politicsLeaders[profile.constitution.leader]));
  current.append(row(s.politicsRegimes[profile.regime], s.politicsDemocracy(profile.polyarchy, profile.liberal)));
  current.append(el("p", "notice", s.politicsNextElection(nextElectionYear(data, "national", state.politics.constitution, year))));
  if (profile.scenario) current.append(el("p", "people-source", s.politicsScenario));
  else if (profile.estimated) current.append(el("p", "people-source", s.politicsEstimate));
  current.append(el("p", "people-source", `${s.politicsSource} ${data.source}`));
  root.append(current);

  const careerSection = section(s.politicsCareer);
  careerSection.append(row(s.politicsExperience, s.politicsExperienceValue(career.experience.local, career.experience.regional, career.experience.national)));
  if (career.status !== "none") careerSection.append(row(s.politicsSupportLabel, s.politicsSupport(career.support)));
  if (career.status === "candidate" && career.nextElectionYear !== null) careerSection.append(el("p", "notice", s.politicsCandidate(career.nextElectionYear)));
  if (career.status === "inOffice" && career.level && career.termEndYear !== null) careerSection.append(el("p", "notice", s.politicsInOffice(s.politicsLevels[career.level], career.termEndYear)));
  if (state.politics.lastResult) careerSection.append(el("p", "politics-result", state.politics.lastResult));
  if (!state.politics.trainingComplete) {
    const plan = button(s.planStart.localPolitics, options.onPlan);
    plan.disabled = !state.alive || state.age < 18 || state.plan !== null;
    careerSection.append(plan);
  } else careerSection.append(el("p", "muted", s.politicsPlanDone));
  root.append(careerSection);

  const campaign = section(s.politicsCampaign);
  campaign.append(el("p", "muted", s.politicsRequirements));
  const levelSelect = selectNode(s.politicsLevels.local);
  for (const level of ["local", "regional", "national"] as PoliticalLevel[]) addOption(levelSelect, level, s.politicsLevels[level], "local");
  campaign.append(levelSelect);
  const costText = el("p", "politics-campaign-cost");
  const platformButtons: HTMLButtonElement[] = [];
  const updateCampaign = () => {
    const level = levelSelect.value as PoliticalLevel;
    const next = nextElectionYear(data, level, state.politics.constitution, year);
    costText.textContent = `${s.politicsCampaignCost(s.politicsLevels[level], s.money(campaignCost(state, level)))} · ${s.politicsNextElection(next)}`;
    for (const item of platformButtons) item.disabled = !canRunForOffice(state, level) || state.finance.cash < campaignCost(state, level) || next === null;
  };
  const platforms = el("div", "politics-platforms");
  const colors = ["btn-bonds", "btn-self", "btn-change", "btn-tradition"];
  (["community", "welfare", "market", "order"] as PoliticalPlatform[]).forEach((platform, index) => {
    const item = button(`${s.politicsPlatforms[platform]} · ${s.politicsPlatformDetails[platform]}`, () => options.onCampaign(levelSelect.value as PoliticalLevel, platform));
    item.classList.add(colors[index]);
    platformButtons.push(item);
    platforms.append(item);
  });
  levelSelect.addEventListener("change", updateCampaign);
  campaign.append(costText, platforms);
  updateCampaign();
  root.append(campaign);

  const constitution = section(s.politicsConstitution);
  for (const field of ["form", "leader", "termYears", "termLimit", "legislature", "judiciary"] as AmendmentField[]) {
    const value = state.politics.constitution[field];
    constitution.append(row(s.politicsFields[field], field === "legislature" || field === "judiciary" ? s.politicsEnabled(Boolean(value)) : valueLabel(field, value)));
  }
  constitution.append(el("p", "muted", s.politicsOneAmendment));
  if (career.amendmentUsed) constitution.append(el("p", "notice", s.politicsAmendmentUsed));
  const fieldSelect = selectNode(s.politicsFields.form);
  for (const field of Object.keys(s.politicsFields) as AmendmentField[]) addOption(fieldSelect, field, s.politicsFields[field], "form");
  const valueSelect = selectNode(s.politicsFields.form);
  const referendum = button("", () => options.onReferendum(fieldSelect.value as AmendmentField, parseValue(fieldSelect.value as AmendmentField, valueSelect.value)));
  const updateAmendment = () => {
    const field = fieldSelect.value as AmendmentField;
    valueSelect.setAttribute("aria-label", s.politicsFields[field]);
    valueSelect.replaceChildren();
    for (const value of valueOptions(field, state)) addOption(valueSelect, String(value), valueLabel(field, value), String(state.politics.constitution[field]));
    const enabled = state.alive && career.status === "inOffice" && career.level === "national" && !career.amendmentUsed;
    referendum.disabled = !enabled || valueSelect.value === String(state.politics.constitution[field]);
    referendum.textContent = s.politicsReferendum(referendumChance(state, data, field));
  };
  fieldSelect.addEventListener("change", updateAmendment);
  valueSelect.addEventListener("change", () => {
    const enabled = state.alive && career.status === "inOffice" && career.level === "national" && !career.amendmentUsed;
    referendum.disabled = !enabled || valueSelect.value === String(state.politics.constitution[fieldSelect.value as AmendmentField]);
  });
  constitution.append(fieldSelect, valueSelect, referendum);
  updateAmendment();
  const usurpation = button(s.politicsUsurpation(usurpationChance(state, data)), options.onUsurpation);
  usurpation.className = "politics-usurpation";
  usurpation.disabled = !state.alive || career.status !== "inOffice" || career.level !== "national" || career.amendmentUsed;
  constitution.append(el("p", "people-source", s.politicsUsurpationWarning), usurpation);
  root.append(constitution);

  const alternative = section(s.politicsAlternative);
  alternative.append(row(s.politicsOriginalGdp, s.money(options.baseGdp)));
  alternative.append(row(s.politicsAlternativeGdp, s.money(alternativeGdp(state, options.baseGdp))));
  alternative.append(row(s.politicsOriginalMortality, s.politicsFactor(1)));
  alternative.append(row(s.politicsAlternativeMortality, s.politicsFactor(state.politics.alternative.mortalityFactor)));
  if (!state.politics.alternative.active) alternative.append(el("p", "muted", s.politicsNoAlternative));
  const pending = [...state.politics.alternative.pending].sort((a, b) => a.effectiveYear - b.effectiveYear)[0];
  if (pending) alternative.append(el("p", "notice", s.politicsPending(pending.effectiveYear)));
  alternative.append(el("h3", undefined, s.politicsChanges));
  if (state.politics.alternative.changes.length === 0) alternative.append(el("p", "muted", s.politicsNoChanges));
  const changes = el("ol", "politics-changes");
  for (const change of state.politics.alternative.changes) {
    const field = change.field === "usurpation" ? s.politicsUsurpationField : s.politicsFields[change.field];
    const values = change.field === "usurpation" ? "" : ` · ${valueLabel(change.field, change.before ?? "")} → ${valueLabel(change.field, change.after ?? "")}`;
    const method = change.method === "referendum" ? s.politicsReferendumMethod : s.politicsUsurpationMethod;
    const item = el("li");
    item.append(el("span", "memory-meta", s.politicsChangeMeta(change.year, method, change.success)), el("span", undefined, `${field}${values}`));
    changes.append(item);
  }
  alternative.append(changes);
  root.append(alternative);
  return root;
}
