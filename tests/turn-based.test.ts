import { describe, expect, it } from "vitest";
import { applyChoice } from "../src/core/turn.ts";
import { EVENTS } from "../src/content/events.ts";
import { newState, names } from "./helpers.ts";

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
});
