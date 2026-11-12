import { rngFromSeed, weightedIndex } from "./rng.ts";
import type { Rng } from "./rng.ts";
import { weightOf } from "./events.ts";
import type { Choice, LifeEvent, Sector } from "./events.ts";
import { clampScale, initScales, mortalityMultiplier } from "./state.ts";
import type { LifeState, Scales } from "./state.ts";
import type { Birth, MortData } from "./types.ts";
import { HISTORY } from "../content/history.ts";

export const MILESTONE_AGES = [6, 12, 16, 18];
export const QUIET_YEAR_CHANCE = 0.35;
export const EVENT_COOLDOWN_YEARS = 5;

export function createLifeState(seed: string, birth: Birth, gdpPerCapita: number): LifeState {
  return {
    seed,
    birth,
    age: 0,
    scales: initScales(gdpPerCapita),
    compass: { tradition: 0, bonds: 0, choices: 0 },
    modifiers: [],
    chronicle: [],
    alive: true,
    deathYear: null,
    pendingEventIds: [],
    usedEventIds: [],
    recentEvents: [],
    lastOutcome: null,
    lastArrows: null,
    softenHeavy: false,
  };
}

function subRng(s: LifeState, salt: string): Rng {
  return rngFromSeed(`${s.seed}:${s.age}:${salt}`);
}

function eligible(s: LifeState, events: LifeEvent[]): LifeEvent[] {
  return events.filter(
    (e) =>
      s.age >= e.minAge &&
      s.age <= e.maxAge &&
      !(e.heavy && s.softenHeavy) &&
      !(e.once && s.usedEventIds.includes(e.id)) &&
      !s.recentEvents.some((r) => r.id === e.id && s.age - r.age < EVENT_COOLDOWN_YEARS) &&
      (!e.condition || e.condition(s)),
  );
}

/** Событие(я) года: на вехах и при кризисе — выбор до 3, иначе 1 по весу-уместности.
 *  Обычный год может оказаться тихим (без события) — такие годы проматываются. */
export function pickYearEvents(s: LifeState, events: LifeEvent[]): LifeEvent[] {
  const pool = eligible(s, events);
  if (pool.length === 0) return [];
  const rng = subRng(s, "pick");
  const hasCrisis = pool.some((e) => e.crisis);
  const isMilestone = MILESTONE_AGES.includes(s.age);
  if (!isMilestone && !hasCrisis && rng() < QUIET_YEAR_CHANCE) return [];
  const count = isMilestone || hasCrisis ? Math.min(3, pool.length) : 1;
  const chosen: LifeEvent[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count; i++) {
    const idx = weightedIndex(rng, remaining.map((e) => weightOf(e, s)));
    chosen.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return chosen;
}

function applyEffects(s: LifeState, effects: Partial<Scales>): void {
  for (const k of Object.keys(effects) as (keyof Scales)[]) {
    s.scales[k] = clampScale(s.scales[k] + (effects[k] ?? 0));
  }
}

function compassDelta(sector: Sector): { tradition: number; bonds: number } {
  return {
    tradition: sector === "tradition" ? 1 : sector === "change" ? -1 : 0,
    bonds: sector === "bonds" ? 1 : sector === "self" ? -1 : 0,
  };
}

export function applyChoice(s: LifeState, event: LifeEvent, choiceIndex: number): void {
  const choice: Choice = event.choices[choiceIndex];
  let outcome = choice.outcome;
  let arrows = { ...choice.effects };
  if (choice.risk) {
    const r = subRng(s, `${event.id}:risk`)();
    if (r < choice.risk.chance) {
      outcome = choice.risk.successText;
      arrows = choice.risk.successEffects;
    } else {
      outcome = choice.risk.failText;
      arrows = choice.risk.failEffects;
    }
  }
  applyEffects(s, arrows);
  if (choice.mortality) {
    s.modifiers = s.modifiers.filter((m) => m.id !== event.id);
    s.modifiers.push({ id: event.id, mult: choice.mortality.mult, untilAge: choice.mortality.untilAge });
  }
  const delta = compassDelta(choice.sector);
  s.compass.tradition += delta.tradition;
  s.compass.bonds += delta.bonds;
  s.compass.choices++;
  s.chronicle.push({ age: s.age, year: s.birth.year + s.age, text: outcome });
  if (event.once) s.usedEventIds.push(event.id);
  s.recentEvents.push({ id: event.id, age: s.age });
  if (s.recentEvents.length > 30) s.recentEvents.shift();
  s.lastOutcome = outcome;
  s.lastArrows = arrows;
  s.pendingEventIds = [];
}

/** Завершение года после выбора: проверка смерти (когортная qx × множители) или +1 год. */
export function advanceYear(s: LifeState, mort: MortData): void {
  if (!s.alive) return;
  const q = s.birth.year + s.age;
  const tableYear = Math.min(q, 2100);
  const base = mort.q[s.birth.sex][tableYear - 1950][Math.min(s.age, 100)] / mort.scale;
  const died = subRng(s, "death")() < Math.min(1, base * mortalityMultiplier(s));
  if (died) {
    s.alive = false;
    s.deathYear = s.birth.year + s.age;
    return;
  }
  s.age++;
  // Возрастной дрейф: здоровье снижается с годами; близкие без внимания остывают к 50.
  if (s.age >= 50) s.scales.health = clampScale(s.scales.health - (s.age >= 70 ? 1.2 : 0.5));
  s.scales.bonds = clampScale(s.scales.bonds + Math.sign(50 - s.scales.bonds) * 0.3);
  const year = s.birth.year + s.age;
  for (const h of HISTORY) {
    if (h.year === year) s.chronicle.push({ age: s.age, year, text: h.text });
  }
  s.lastOutcome = null;
  s.lastArrows = null;
}
