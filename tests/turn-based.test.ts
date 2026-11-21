import { describe, expect, it } from "vitest";
import { applyChoice } from "../src/core/turn.ts";
import { completeYear, hasDecision, pendingEvent, scheduleFollowUpAfterChoice, schedulePendingEvents } from "../src/core/flow.ts";
import { EVENTS } from "../src/content/events.ts";
import { income, newState, names } from "./helpers.ts";

describe("пошаговая очередь решений", () => {
  it("на вехе удаляет только выбранное событие и сохраняет остальные", () => {
    const { s } = newState("turn-based-queue");
    s.age = 6;
    const events = EVENTS.filter((event) => s.age >= event.minAge && s.age <= event.maxAge && !event.crisis).slice(0, 3);
    expect(events).toHaveLength(3);
    s.pendingEventIds = events.map((event) => event.id);
    applyChoice(s, events[1], 0, names);
    expect(s.pendingEventIds).toEqual([events[0].id, events[2].id]);
    expect(s.compass.choices).toBe(1);
  });

  it("после единственного решения очередь пуста и год может завершиться", () => {
    const { s } = newState("turn-based-single");
    s.age = 6;
    const event = EVENTS.find((item) => s.age >= item.minAge && s.age <= item.maxAge && !item.crisis)!;
    s.pendingEventIds = [event.id];
    applyChoice(s, event, 0, names);
    expect(s.pendingEventIds).toEqual([]);
    expect(s.lastOutcome).not.toBeNull();
  });

  it("UI-flow обрабатывает все события вехи, включая вставленные follow-up сцены", () => {
    const { s, conflict } = newState("turn-based-milestone");
    s.age = 6;
    schedulePendingEvents(s, conflict);
    const expected = [...s.pendingEventIds];
    expect(expected.length).toBeGreaterThan(1);
    const resolved: string[] = [];
    let guard = 0;
    while (hasDecision(s)) {
      if (guard++ > 16) throw new Error("queue did not drain");
      const event = pendingEvent(s)!;
      expect(event).not.toBeNull();
      resolved.push(event.id);
      applyChoice(s, event, 0, names, conflict);
      scheduleFollowUpAfterChoice(s, conflict);
    }
    for (const id of expected) expect(resolved).toContain(id);
    expect(s.compass.choices).toBeGreaterThanOrEqual(expected.length);
    expect(s.pendingEventIds).toEqual([]);
  });

  it("тихий год сохраняет последний исход и сбрасывает доли фокуса", () => {
    let checked = false;
    for (let i = 0; i < 30 && !checked; i++) {
      const { s, mort, family, conflict, politics } = newState(`quiet-flow-${i}`);
      s.lastOutcome = "Прежний исход";
      s.lastOutcomeKind = "life";
      s.lastArrows = { health: 1 };
      s.focus.fractions = { balance: 1 };
      s.time.tick = 8;
      const gdpTable = income.gdp[s.birth.country.iso3] ?? income.gdp._world;
      completeYear(s, mort, family, names, conflict, gdpTable[Math.min(s.birth.year + s.age, 2022) - 1950], politics);
      if (hasDecision(s)) continue;
      expect(s.lastOutcome).toBe("Прежний исход");
      expect(s.lastOutcomeKind).toBe("life");
      expect(s.lastArrows).toEqual({ health: 1 });
      expect(s.focus.fractions).toEqual({});
      expect(s.time.tick).toBe(0);
      checked = true;
    }
    expect(checked).toBe(true);
  });
});
