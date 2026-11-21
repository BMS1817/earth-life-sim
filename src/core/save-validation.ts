import type { LifeState } from "./state.ts";

type UnknownRecord = Record<string, unknown>;

const FOCUS_IDS = ["balance", "money", "education", "bonds", "happiness"];
const HOBBY_IDS = ["games", "sports", "reading", "music", "crafts", "nature"];
const CAREER_IDS = ["medicine", "education", "engineering", "industry", "agriculture", "services", "pilot"];
const PROPERTY_IDS = ["computer", "bicycle", "car", "home"];
const TRAITS = ["warm", "reserved", "stubborn", "curious", "practical", "impulsive", "loyal", "independent"];
const PATTERNS = ["hearthKeeper", "steadyPath", "lonelyOrder", "warmCircle", "ownConstellation", "quietOrbit", "freeFellowship", "pathfinder", "freeWanderer"];

function record(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, min = -Number.MAX_VALUE, max = Number.MAX_VALUE): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function integer(value: unknown, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && finite(value, min, max);
}

function text(value: unknown, maxLength = 10000): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function bool(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function oneOf(value: unknown, values: string[]): boolean {
  return typeof value === "string" && values.includes(value);
}

function nullable(value: unknown, validate: (value: unknown) => boolean): boolean {
  return value === null || validate(value);
}

function array(value: unknown, validate: (item: unknown) => boolean, maxLength = 100000): value is unknown[] {
  return Array.isArray(value) && value.length <= maxLength && value.every(validate);
}

function strings(value: unknown): boolean {
  return array(value, (item) => text(item, 1000));
}

function numbers(value: unknown, min = 0): boolean {
  return array(value, (item) => finite(item, min), 1000);
}

function numberRecord(value: unknown, keys?: string[], min = -Number.MAX_VALUE): value is UnknownRecord {
  return record(value) && Object.entries(value).every(([key, item]) => (!keys || keys.includes(key)) && finite(item, min));
}

function requiredNumbers(value: unknown, keys: string[], min = -Number.MAX_VALUE, max = Number.MAX_VALUE): boolean {
  return numberRecord(value, keys, min) && keys.every((key) => finite(value[key], min, max));
}

function requiredBooleans(value: unknown, keys: string[]): value is UnknownRecord {
  return record(value) && keys.every((key) => bool(value[key]));
}

function year(value: unknown): boolean {
  return integer(value, 1800, 2200);
}

function birthValid(value: unknown): boolean {
  if (!record(value) || !year(value.year) || !oneOf(value.sex, ["M", "F"]) || !text(value.name, 200) || !record(value.country)) return false;
  const country = value.country;
  return integer(country.code, 0) && nullable(country.iso2, (item) => typeof item === "string" && /^[A-Z]{2}$/.test(item)) &&
    typeof country.iso3 === "string" && /^[A-Z0-9]{3}$/.test(country.iso3) && text(country.name, 200) &&
    numbers(country.births) && numbers(country.srb);
}

function chronicleValid(value: unknown): boolean {
  return array(value, (item) => record(item) && integer(item.age, 0, 150) && year(item.year) && text(item.text) &&
    (item.source === undefined || oneOf(item.source, ["hero", "people", "history", "pattern"])));
}

function peopleValid(value: unknown): boolean {
  return array(value, (person) => {
    if (!record(person)) return false;
    return text(person.id, 200) && text(person.name, 200) && oneOf(person.sex, ["M", "F"]) && year(person.birthYear) &&
      oneOf(person.role, ["mother", "father", "sibling", "partner", "child", "friend", "grandparent", "relative"]) &&
      array(person.traits, (trait) => oneOf(trait, TRAITS), 8) && array(person.knownTraits, (trait) => oneOf(trait, TRAITS), 8) &&
      finite(person.initialRelationship, 0, 100) && bool(person.alive) && nullable(person.deathYear, year) &&
      oneOf(person.status, ["active", "estranged", "ended"]) && bool(person.present) &&
      array(person.memories, (memory) => record(memory) && integer(memory.age, 0, 150) && year(memory.year) &&
        text(memory.eventId, 200) && text(memory.text) && finite(memory.impact, -100, 100) &&
        oneOf(memory.kind, ["support", "conflict", "care", "loss", "milestone"]));
  });
}

function financeValid(value: unknown): boolean {
  if (!record(value)) return false;
  const breakdownKeys = ["income", "expenses", "interest", "lifestyle", "rentals", "business", "property", "politics"];
  return finite(value.cash) && finite(value.bonds, 0) && finite(value.risky, 0) && finite(value.gdpPerCapita, 0.01) &&
    finite(value.education, 0, 100) && nullable(value.career, (item) => oneOf(item, CAREER_IDS)) &&
    integer(value.careerLevel, 1, 10) && nullable(value.careerStartYear, year) &&
    oneOf(value.employment, ["school", "employed", "unemployed", "retired"]) && nullable(value.unemployedUntil, year) &&
    oneOf(value.housing, ["parents", "rent", "owned", "mortgage"]) && integer(value.mortgageYearsLeft, 0, 100) &&
    nullable(value.lastInvestmentYear, year) && finite(value.lastYearNet) && requiredNumbers(value.lastBreakdown, breakdownKeys) &&
    nullable(value.lastRiskyReturn, (item) => finite(item, -1, 1)) && bool(value.lastExpenseShortfall);
}

function politicsValid(value: unknown): boolean {
  if (!record(value) || !bool(value.trainingComplete) || !record(value.career) || !record(value.constitution) || !record(value.alternative)) return false;
  const career = value.career;
  const constitution = value.constitution;
  const alternative = value.alternative;
  const amendmentValue = (item: unknown) => nullable(item, (entry) => text(entry, 200) || finite(entry) || bool(entry));
  return oneOf(career.status, ["none", "candidate", "inOffice"]) &&
    nullable(career.level, (item) => oneOf(item, ["local", "regional", "national"])) &&
    nullable(career.lastLevel, (item) => oneOf(item, ["local", "regional", "national"])) &&
    oneOf(career.platform, ["community", "welfare", "market", "order"]) && finite(career.support, 0, 100) &&
    requiredNumbers(career.experience, ["local", "regional", "national"], 0) &&
    nullable(career.nextElectionYear, year) && nullable(career.termStartYear, year) && nullable(career.termEndYear, year) &&
    integer(career.termsServed, 0, 1000) && bool(career.amendmentUsed) &&
    oneOf(constitution.form, ["presidential", "semiPresidential", "parliamentary", "monarchy", "council"]) &&
    oneOf(constitution.leader, ["popular", "legislature", "appointed", "hereditary"]) &&
    integer(constitution.termYears, 0, 20) && integer(constitution.termLimit, 0, 20) &&
    bool(constitution.legislature) && bool(constitution.judiciary) && bool(alternative.active) &&
    finite(alternative.gdpFactor, 0.01, 100) && finite(alternative.mortalityFactor, 0.01, 100) &&
    array(alternative.pending, (item) => record(item) && year(item.effectiveYear) && finite(item.gdp) && finite(item.mortality)) &&
    array(alternative.changes, (item) => record(item) && year(item.year) &&
      oneOf(item.field, ["form", "leader", "termYears", "termLimit", "legislature", "judiciary", "usurpation"]) &&
      amendmentValue(item.before) && amendmentValue(item.after) && oneOf(item.method, ["referendum", "usurpation"]) && bool(item.success)) &&
    nullable(value.lastResult, (item) => text(item));
}

function lineageValid(value: unknown): boolean {
  if (!record(value) || !integer(value.generation, 1, 1000)) return false;
  const report = value.lastInheritance;
  return array(value.ancestors, (ancestor) => record(ancestor) && text(ancestor.name, 200) && oneOf(ancestor.sex, ["M", "F"]) &&
    year(ancestor.birthYear) && year(ancestor.deathYear) && text(ancestor.countryIso3, 3) &&
    oneOf(ancestor.patternName, PATTERNS) && text(ancestor.patternColor, 30) && chronicleValid(ancestor.moments)) &&
    array(value.heroTraits, (trait) => oneOf(trait, TRAITS), 8) &&
    (report === null || (record(report) && year(report.year) && text(report.parentName, 200) && text(report.heirName, 200) &&
      integer(report.childrenCount, 1, 100) && finite(report.cashShare) && finite(report.bondsShare, 0) && finite(report.riskyShare, 0) &&
      finite(report.insurance, 0) && integer(report.rentals, 0, 3) && bool(report.business) && finite(report.education, 0, 100) &&
      oneOf(report.trait, TRAITS)));
}

export function validLifeState(value: unknown): value is LifeState {
  if (!record(value) || value.version !== 10 || !text(value.seed, 512) || value.seed.length === 0 || !birthValid(value.birth) || !Array.isArray(value.chronicle)) return false;
  const chronicle = value.chronicle;
  const plan = value.plan;
  const activeHobby = value.activeHobbyId;
  const lastArrows = value.lastArrows;
  return integer(value.age, 0, 150) && requiredNumbers(value.scales, ["health", "money", "education", "bonds"], 0, 100) &&
    finite(value.happiness, 0, 100) &&
    array(value.happinessHistory, (point) => record(point) && integer(point.age, 0, 150) && year(point.year) && finite(point.value, 0, 100)) &&
    record(value.focus) && oneOf(value.focus.current, FOCUS_IDS) && numberRecord(value.focus.fractions, FOCUS_IDS, 0) &&
    finite(value.focus.careerPoints, 0) && numberRecord(value.focusTotals, FOCUS_IDS, 0) &&
    array(value.favoriteMomentIndexes, (index) => integer(index, 0) && index < chronicle.length, 32) &&
    new Set(value.favoriteMomentIndexes).size === value.favoriteMomentIndexes.length &&
    array(value.hobbies, (hobby) => record(hobby) && oneOf(hobby.id, HOBBY_IDS) && finite(hobby.xp, 0) && integer(hobby.level, 0, 10), 6) &&
    nullable(activeHobby, (item) => oneOf(item, HOBBY_IDS)) &&
    record(value.time) && integer(value.time.tick, 0, 1000) && finite(value.time.speed, 1, 16) && bool(value.time.auto) &&
    (plan === null || (record(plan) && oneOf(plan.kind, ["jobSearch", "courses", "dream", "flightSchool", "localPolitics"]) &&
      integer(plan.remainingYears, 0, 100) && nullable(plan.dreamCareer, (item) => oneOf(item, CAREER_IDS)))) &&
    requiredBooleans(value.lifestyle, ["autoGifts", "autoCourses", "autoHealth", "autoTravel", "autoHobbyLessons", "insurance"]) &&
    oneOf(value.lifestyle.nutrition, ["normal", "healthy", "convenience"]) &&
    array(value.pets, (pet) => record(pet) && text(pet.id, 200) && oneOf(pet.kind, ["dog", "cat", "small"]) && text(pet.name, 200) &&
      year(pet.adoptedYear) && nullable(pet.deathYear, year) && finite(pet.lifespan, 1, 100)) &&
    record(value.property) && array(value.property.items, (item) => oneOf(item, PROPERTY_IDS), 4) &&
    numberRecord(value.property.acquired, PROPERTY_IDS, 0) && integer(value.property.rentals, 0, 3) &&
    (value.property.business === null || (record(value.property.business) && oneOf(value.property.business.kind, ["shop", "cafe", "workshop"]) &&
      year(value.property.business.startedYear) && integer(value.property.business.successfulYears, 0, 1000) && integer(value.property.business.level, 1, 100))) &&
    record(value.compass) && finite(value.compass.tradition) && finite(value.compass.bonds) && integer(value.compass.choices, 0) &&
    array(value.modifiers, (modifier) => record(modifier) && text(modifier.id, 200) && finite(modifier.mult, 0, 100) && nullable(modifier.untilAge, (item) => integer(item, 0, 150))) &&
    chronicleValid(value.chronicle) && bool(value.alive) && nullable(value.deathYear, year) && strings(value.pendingEventIds) &&
    nullable(value.pendingFamilyEventId, (item) => text(item, 200)) && strings(value.usedEventIds) &&
    array(value.recentEvents, (item) => record(item) && text(item.id, 200) && integer(item.age, 0, 150)) &&
    nullable(value.lastFamilySceneAge, (item) => integer(item, 0, 150)) && nullable(value.lastOutcome, (item) => text(item)) &&
    nullable(value.lastOutcomeKind, (item) => oneOf(item, ["life", "family", "conflict"])) &&
    nullable(value.lastFamilyPersonId, (item) => text(item, 200)) &&
    (lastArrows === null || numberRecord(lastArrows, ["health", "money", "education", "bonds"])) && bool(value.softenHeavy) &&
    peopleValid(value.people) &&
    array(value.peopleNews, (news) => record(news) && oneOf(news.kind, ["death", "birth", "turn"]) && text(news.personId, 200) &&
      integer(news.age, 0, 150) && year(news.year) && text(news.text)) &&
    nullable(value.spouseId, (item) => text(item, 200)) && bool(value.sameSexPartners) && strings(value.patterns) &&
    record(value.war) && array(value.war.seen, (seen) => record(seen) && year(seen.year) &&
      oneOf(seen.phase, ["start", "escalation", "deescalation", "end", "ongoing", "peace"])) &&
    nullable(value.war.displacedUntil, year) && bool(value.war.peopleDisplaced) && finite(value.war.heroRisk, 0, 100) &&
    bool(value.war.heroCombat) && numberRecord(value.war.peopleRisk, undefined, 0) && nullable(value.war.pendingEventId, (item) => text(item, 200)) &&
    financeValid(value.finance) && politicsValid(value.politics) && lineageValid(value.lineage);
}
