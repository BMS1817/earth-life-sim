import type { LifeState, PetKind, PlanKind, PropertyItemId, BusinessKind, LifestyleState } from "../core/state.ts";
import type { CareerId } from "../core/finance.ts";
import { LIFESTYLE_RULES, PLAN_RULES, planCost, propertyCost } from "../content/lifestyle.ts";
import { s } from "./strings.ts";
import { thematicHeader } from "./thematic-header.ts";

interface LifestyleViewOptions {
  onBack: () => void;
  onPlan: (kind: PlanKind, dreamCareer: CareerId | null) => void;
  onPet: (kind: PetKind) => void;
  onProperty: (id: PropertyItemId) => void;
  onRental: () => void;
  onBusiness: (kind: BusinessKind) => void;
  onToggle: (key: "autoGifts" | "autoCourses" | "autoHealth" | "autoTravel" | "autoHobbyLessons" | "insurance", value: boolean) => void;
  onNutrition: (value: LifestyleState["nutrition"]) => void;
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

function section(title: string): HTMLElement {
  const root = el("section", "finance-section");
  root.append(el("h2", undefined, title));
  return root;
}

export function lifestyleView(state: LifeState, options: LifestyleViewOptions): HTMLElement {
  const root = el("div", "lifestyle-view");
  root.append(button(s.back, options.onBack));
  root.append(el("h1", undefined, s.lifestyleTitle), thematicHeader("lifestyle"));
  root.append(el("p", "people-source", s.lifestyleSource));

  const plan = section(s.planTitle);
  if (state.plan) plan.append(row(s.planStart[state.plan.kind], s.planRemaining(state.plan.remainingYears)));
  else {
    plan.append(el("p", "muted", s.planNone));
    for (const kind of ["jobSearch", "courses", "flightSchool"] as PlanKind[]) {
      const cost = planCost(kind, state.finance.gdpPerCapita);
      const b = button(`${s.planStart[kind]}${cost > 0 ? ` · ${s.money(cost)}` : ""}`, () => options.onPlan(kind, null));
      b.disabled = state.age < 18 || state.finance.cash < cost || (kind === "flightSchool" && state.scales.education < 40);
      plan.append(b);
    }
    const dream = el("div", "hobby-add");
    const select = el("select", "hobby-select");
    select.setAttribute("aria-label", s.planDreamCareer);
    for (const id of Object.keys(s.careers).filter((id) => id !== "pilot") as CareerId[]) {
      const option = el("option", undefined, s.careers[id]);
      option.value = id;
      select.append(option);
    }
    const dreamButton = button(`${s.planStart.dream} · ${s.money(planCost("dream", state.finance.gdpPerCapita))}`, () => options.onPlan("dream", select.value as CareerId));
    dreamButton.disabled = state.age < 18 || state.finance.cash < planCost("dream", state.finance.gdpPerCapita);
    dream.append(select, dreamButton);
    plan.append(dream);
  }
  root.append(plan);

  const pets = section(s.petsTitle);
  for (const pet of state.pets) {
    const status = pet.deathYear === null ? s.petAge(state.birth.year + state.age - pet.adoptedYear) : s.petGone(pet.deathYear);
    pets.append(row(`${s.petKinds[pet.kind]} ${pet.name}`, status));
  }
  const petRow = el("div", "hobby-add");
  const petSelect = el("select", "hobby-select");
  for (const kind of ["dog", "cat", "small"] as PetKind[]) {
    const option = el("option", undefined, s.petKinds[kind]);
    option.value = kind;
    petSelect.append(option);
  }
  const adopt = button(s.petAdopt, () => options.onPet(petSelect.value as PetKind));
  adopt.disabled = state.age < 5 || state.pets.filter((pet) => pet.deathYear === null).length >= 2;
  petRow.append(petSelect, adopt);
  pets.append(petRow);
  root.append(pets);

  const property = section(s.propertyTitle);
  for (const id of Object.keys(s.propertyItems) as PropertyItemId[]) {
    const owned = state.property.items.includes(id);
    const b = button(owned ? s.propertyOwned : `${s.propertyBuy} · ${s.money(propertyCost(id, state.finance.gdpPerCapita))}`, () => options.onProperty(id));
    b.disabled = owned || state.age < 18 || state.finance.cash < propertyCost(id, state.finance.gdpPerCapita);
    property.append(row(s.propertyItems[id], ""));
    property.append(b);
  }
  property.append(row(s.rentalTitle, s.rentalCount(state.property.rentals)));
  const rental = button(`${s.rentalBuy} · ${s.money(LIFESTYLE_RULES.rentalCost * state.finance.gdpPerCapita)}`, options.onRental);
  rental.disabled = state.age < 18 || state.property.rentals >= 3 || state.finance.cash < LIFESTYLE_RULES.rentalCost * state.finance.gdpPerCapita;
  property.append(rental);
  const businessRow = el("div", "hobby-add");
  const businessSelect = el("select", "hobby-select");
  for (const kind of ["shop", "cafe", "workshop"] as BusinessKind[]) {
    const option = el("option", undefined, s.businessKinds[kind]);
    option.value = kind;
    businessSelect.append(option);
  }
  const business = button(`${s.businessStart} · ${s.money(LIFESTYLE_RULES.businessCost * state.finance.gdpPerCapita)}`, () => options.onBusiness(businessSelect.value as BusinessKind));
  business.disabled = state.age < 18 || state.property.business !== null || state.finance.cash < LIFESTYLE_RULES.businessCost * state.finance.gdpPerCapita;
  businessRow.append(businessSelect, business);
  property.append(businessRow);
  if (state.property.business) property.append(row(s.businessTitle, s.businessStatus(state.property.business.level, state.property.business.successfulYears)));
  root.append(property);

  const auto = section(s.autoTitle);
  auto.append(el("p", "muted", s.autoGuard));
  for (const key of ["autoGifts", "autoCourses", "autoHealth", "autoTravel", "autoHobbyLessons", "insurance"] as const) {
    const b = button(`${s[key]} · ${s.softenState(state.lifestyle[key])}`, () => options.onToggle(key, !state.lifestyle[key]));
    if (state.lifestyle[key]) b.classList.add("active");
    auto.append(b);
  }
  const nutritionLabel = el("p", undefined, s.nutritionTitle);
  const nutrition = el("select", "hobby-select");
  for (const value of ["normal", "healthy", "convenience"] as const) {
    const option = el("option", undefined, s[`nutrition${value[0].toUpperCase()}${value.slice(1)}` as "nutritionNormal" | "nutritionHealthy" | "nutritionConvenience"]);
    option.value = value;
    nutrition.append(option);
  }
  nutrition.value = state.lifestyle.nutrition;
  nutrition.addEventListener("change", () => options.onNutrition(nutrition.value as LifestyleState["nutrition"]));
  auto.append(nutritionLabel, nutrition);
  root.append(auto);
  return root;
}
