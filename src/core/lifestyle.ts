import { adjustFinanceYear, expensesForYear } from "./finance.ts";
import { clampScale } from "./state.ts";
import type { BusinessKind, LifeState, PetKind, PropertyItemId } from "./state.ts";
import { remember, relationshipOf } from "./people.ts";
import { rngFromSeed } from "./rng.ts";
import { LIFESTYLE_RULES, PET_RULES, PROPERTY_RULES, propertyCost } from "../content/lifestyle.ts";

const PET_NAMES = ["Чарли", "Луна", "Макс", "Нора", "Пиф", "Сима", "Том", "Зефир"];

export function adoptPet(s: LifeState, kind: PetKind): boolean {
  if (s.age < 5 || s.pets.filter((pet) => pet.deathYear === null).length >= 2) return false;
  const id = `${kind}-${s.pets.length}`;
  const rules = PET_RULES[kind];
  const lifespan = Math.floor(rules.minYears + rngFromSeed(`${s.seed}:${id}:lifespan`)() * (rules.maxYears - rules.minYears + 1));
  const name = PET_NAMES[Math.floor(rngFromSeed(`${s.seed}:${id}:name`)() * PET_NAMES.length)];
  s.pets.push({ id, kind, name, adoptedYear: s.birth.year + s.age, deathYear: null, lifespan });
  s.chronicle.push({ age: s.age, year: s.birth.year + s.age, text: `В семье появился питомец ${name}.`, source: "hero" });
  s.happiness = clampScale(s.happiness + 3);
  return true;
}

export function buyProperty(s: LifeState, id: PropertyItemId): boolean {
  if (s.age < 18 || s.property.items.includes(id)) return false;
  const cost = propertyCost(id, s.finance.gdpPerCapita);
  if (s.finance.cash < cost) return false;
  adjustFinanceYear(s, "property", -cost);
  s.property.items.push(id);
  s.property.acquired[id] = s.birth.year + s.age;
  s.happiness = clampScale(s.happiness + PROPERTY_RULES[id].happiness);
  if (id === "home") {
    s.finance.housing = "owned";
    s.finance.mortgageYearsLeft = 0;
  }
  return true;
}

export function buyRental(s: LifeState): boolean {
  if (s.age < 18 || s.property.rentals >= 3) return false;
  const cost = LIFESTYLE_RULES.rentalCost * s.finance.gdpPerCapita;
  if (s.finance.cash < cost) return false;
  adjustFinanceYear(s, "property", -cost);
  s.property.rentals++;
  return true;
}

export function startBusiness(s: LifeState, kind: BusinessKind): boolean {
  if (s.age < 18 || s.property.business !== null) return false;
  const cost = LIFESTYLE_RULES.businessCost * s.finance.gdpPerCapita;
  if (s.finance.cash < cost) return false;
  adjustFinanceYear(s, "property", -cost);
  s.property.business = { kind, startedYear: s.birth.year + s.age, successfulYears: 0, level: 1 };
  return true;
}

function canAutoSpend(s: LifeState, cost: number): boolean {
  const year = s.birth.year + s.age;
  const children = s.people.filter((p) => p.role === "child" && p.alive && year - p.birthYear < 18).length;
  const partner = s.people.some((p) => p.role === "partner" && p.alive && p.status === "active");
  const required = expensesForYear(s.finance, s.age, children, partner);
  return s.finance.cash >= 0 && s.finance.cash - cost >= required;
}

function closestMemory(s: LifeState, eventId: string, text: string, impact: number): void {
  const closest = s.people.filter((p) => p.alive && p.status === "active").sort((a, b) => relationshipOf(b) - relationshipOf(a) || a.id.localeCompare(b.id))[0];
  if (closest) remember(closest, s.age, s.birth.year + s.age, eventId, text, impact, impact >= 0 ? "care" : "conflict");
}

function processPets(s: LifeState, year: number): void {
  for (const pet of s.pets) {
    if (pet.deathYear !== null) continue;
    const rules = PET_RULES[pet.kind];
    adjustFinanceYear(s, "lifestyle", -rules.annualCost * s.finance.gdpPerCapita);
    s.happiness = clampScale(s.happiness + rules.happiness);
    if (year - pet.adoptedYear >= pet.lifespan) {
      pet.deathYear = year;
      const text = `${pet.name} ушёл из жизни после долгих лет вместе.`;
      s.chronicle.push({ age: s.age, year, text, source: "people" });
      s.peopleNews.push({ kind: "turn", personId: pet.id, age: s.age, year, text });
      s.happiness = clampScale(s.happiness - 4);
    }
  }
}

function processProperty(s: LifeState, year: number): void {
  for (const id of s.property.items) {
    if (id === "computer") {
      s.scales.education = clampScale(s.scales.education + 0.5);
      s.happiness = clampScale(s.happiness + 0.25);
    } else if (id === "bicycle") {
      s.scales.health = clampScale(s.scales.health + 0.5);
      s.happiness = clampScale(s.happiness + 0.25);
    } else if (id === "car") {
      const ownedYears = Math.max(0, year - (s.property.acquired.car ?? year));
      const repairs = ownedYears >= 3 ? 0.05 : 0;
      adjustFinanceYear(s, "lifestyle", -(PROPERTY_RULES.car.annualCost + repairs) * s.finance.gdpPerCapita);
      s.happiness = clampScale(s.happiness + 0.5);
    } else if (id === "home") {
      s.happiness = clampScale(s.happiness + 0.25);
    }
  }
  for (let i = 0; i < s.property.rentals; i++) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.rentalMaintenance * s.finance.gdpPerCapita);
    const occupied = rngFromSeed(`${s.seed}:${year}:rental-${i}`)() >= LIFESTYLE_RULES.rentalVacancyChance;
    if (occupied) adjustFinanceYear(s, "rentals", LIFESTYLE_RULES.rentalIncome * s.finance.gdpPerCapita);
  }
}

function processBusiness(s: LifeState, year: number): void {
  const business = s.property.business;
  if (!business) return;
  const age = year - business.startedYear;
  if (age >= 2 && rngFromSeed(`${s.seed}:${year}:business-failure`)() < LIFESTYLE_RULES.businessFailureChance) {
    s.chronicle.push({ age: s.age, year, text: "Дело пришлось закрыть из-за убытков.", source: "hero" });
    s.property.business = null;
    return;
  }
  const roll = rngFromSeed(`${s.seed}:${year}:business-result`)();
  const factor = 1 + (business.level - 1) * 0.25;
  if (roll < 0.6) {
    adjustFinanceYear(s, "business", LIFESTYLE_RULES.businessProfit * factor * s.finance.gdpPerCapita);
    business.successfulYears++;
    business.level = Math.min(3, 1 + Math.floor(business.successfulYears / 3));
  } else if (roll >= 0.85) {
    adjustFinanceYear(s, "business", LIFESTYLE_RULES.businessLoss * s.finance.gdpPerCapita);
  }
}

function processNutritionAndInsurance(s: LifeState): void {
  if (s.lifestyle.nutrition === "healthy") {
    if (canAutoSpend(s, LIFESTYLE_RULES.healthyFoodCost * s.finance.gdpPerCapita)) {
      adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.healthyFoodCost * s.finance.gdpPerCapita);
      s.scales.health = clampScale(s.scales.health + 0.5);
    }
  } else if (s.lifestyle.nutrition === "convenience") {
    if (canAutoSpend(s, LIFESTYLE_RULES.convenienceFoodCost * s.finance.gdpPerCapita)) {
      adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.convenienceFoodCost * s.finance.gdpPerCapita);
      s.scales.health = clampScale(s.scales.health - 0.5);
      s.happiness = clampScale(s.happiness + 0.5);
    }
  }
  if (s.lifestyle.insurance && canAutoSpend(s, LIFESTYLE_RULES.insuranceCost * s.finance.gdpPerCapita)) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.insuranceCost * s.finance.gdpPerCapita);
    s.scales.health = clampScale(s.scales.health + 0.25);
  }
}

function processAutoSpending(s: LifeState, year: number): void {
  const gdp = s.finance.gdpPerCapita;
  if (s.lifestyle.autoGifts && canAutoSpend(s, LIFESTYLE_RULES.gifts.cost * gdp)) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.gifts.cost * gdp);
    s.happiness = clampScale(s.happiness + LIFESTYLE_RULES.gifts.happiness);
    closestMemory(s, "auto-gifts", "Подарки и время для близких.", LIFESTYLE_RULES.gifts.bonds);
  }
  if (s.lifestyle.autoCourses && year % LIFESTYLE_RULES.courses.interval === 0 && canAutoSpend(s, LIFESTYLE_RULES.courses.cost * gdp)) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.courses.cost * gdp);
    s.scales.education = clampScale(s.scales.education + LIFESTYLE_RULES.courses.education);
    s.focus.careerPoints += LIFESTYLE_RULES.courses.careerPoints;
  }
  if (s.lifestyle.autoHealth && canAutoSpend(s, LIFESTYLE_RULES.health.cost * gdp)) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.health.cost * gdp);
    s.scales.health = clampScale(s.scales.health + LIFESTYLE_RULES.health.health);
    s.happiness = clampScale(s.happiness + LIFESTYLE_RULES.health.happiness);
  }
  if (s.lifestyle.autoTravel && canAutoSpend(s, LIFESTYLE_RULES.travel.cost * gdp)) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.travel.cost * gdp);
    s.happiness = clampScale(s.happiness + LIFESTYLE_RULES.travel.happiness);
    s.scales.education = clampScale(s.scales.education + LIFESTYLE_RULES.travel.education);
    closestMemory(s, "auto-travel", "Совместное путешествие с близкими.", LIFESTYLE_RULES.travel.bonds);
  }
  const active = s.hobbies.find((hobby) => hobby.id === s.activeHobbyId);
  if (active && s.lifestyle.autoHobbyLessons && canAutoSpend(s, LIFESTYLE_RULES.hobbyLessons.cost * gdp)) {
    adjustFinanceYear(s, "lifestyle", -LIFESTYLE_RULES.hobbyLessons.cost * gdp);
    active.xp += LIFESTYLE_RULES.hobbyLessons.hobbyXp;
  }
}

export function processLifestyleYear(s: LifeState): void {
  const year = s.birth.year + s.age;
  processPets(s, year);
  processProperty(s, year);
  processBusiness(s, year);
  processNutritionAndInsurance(s);
  processAutoSpending(s, year);
}
