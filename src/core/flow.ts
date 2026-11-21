import { CONFLICT_EVENTS } from "../content/conflict-events.ts";
import { EVENTS } from "../content/events.ts";
import { FAMILY_EVENTS } from "../content/family-events.ts";
import type { ConflictData } from "./conflicts.ts";
import type { LifeEvent } from "./events.ts";
import type { PoliticsData } from "./politics.ts";
import type { LifeState } from "./state.ts";
import type { FamilyData, MortData, NamesData } from "./types.ts";
import { advanceYear, pickConflictEvent, pickFamilyEvent, pickYearEvents } from "./turn.ts";

export function hasDecision(state: LifeState): boolean {
  return state.pendingEventIds.length > 0 || state.pendingFamilyEventId !== null || state.war.pendingEventId !== null;
}

export function pendingEvent(state: LifeState): LifeEvent | null {
  if (state.war.pendingEventId) return CONFLICT_EVENTS.find((event) => event.id === state.war.pendingEventId) ?? null;
  if (state.pendingFamilyEventId) return FAMILY_EVENTS.find((event) => event.id === state.pendingFamilyEventId) ?? null;
  if (state.pendingEventIds.length > 0) return EVENTS.find((event) => event.id === state.pendingEventIds[0]) ?? null;
  return null;
}

export function completeYear(
  state: LifeState,
  mort: MortData,
  family: FamilyData,
  names: NamesData,
  conflict: ConflictData,
  gdpPerCapita: number,
  politics: PoliticsData,
): void {
  const lastOutcome = state.lastOutcome;
  const lastOutcomeKind = state.lastOutcomeKind;
  const lastArrows = state.lastArrows;
  state.focus.fractions = {};
  state.time.tick = 0;
  advanceYear(state, mort, family, names, conflict, gdpPerCapita, politics);
  if (!state.alive) return;
  state.lastOutcome = lastOutcome;
  state.lastOutcomeKind = lastOutcomeKind;
  state.lastArrows = lastArrows;
  schedulePendingEvents(state, conflict);
}

export function schedulePendingEvents(state: LifeState, conflict: ConflictData): void {
  if (!state.alive || hasDecision(state)) return;
  const events = pickYearEvents(state, EVENTS);
  if (events.length > 0) {
    state.pendingEventIds = events.map((event) => event.id);
    return;
  }
  const conflictEvent = pickConflictEvent(state, conflict);
  if (conflictEvent) {
    state.war.pendingEventId = conflictEvent.id;
    return;
  }
  const familyEvent = pickFamilyEvent(state, FAMILY_EVENTS);
  if (familyEvent) state.pendingFamilyEventId = familyEvent.id;
}

export function scheduleFollowUpAfterChoice(state: LifeState, conflict: ConflictData): void {
  if (state.lastOutcomeKind !== "life") return;
  const conflictEvent = pickConflictEvent(state, conflict);
  if (conflictEvent) {
    state.war.pendingEventId = conflictEvent.id;
    return;
  }
  const familyEvent = pickFamilyEvent(state, FAMILY_EVENTS);
  if (familyEvent) state.pendingFamilyEventId = familyEvent.id;
}
