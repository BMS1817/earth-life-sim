import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLanguage } from "../src/i18n.ts";
import { hasTranslation, translateContent } from "../src/content/en/catalog.ts";
import { ALL_EVENTS } from "../src/content/events.ts";
import { FAMILY_EVENTS } from "../src/content/family-events.ts";
import { eventText } from "../src/core/turn.ts";
import { s } from "../src/ui/strings.ts";
import { newState } from "./helpers.ts";

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

beforeEach(() => {
  const data = new Map<string, string>([["earth:language", "en"]]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
});

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("локализация", () => {
  it("переключает интерфейс по сохранённому языку", () => {
    expect(getLanguage()).toBe("en");
    expect(s.title).toBe("Earth — one life simulator");
    expect(s.newLife).toBe("New life");
    expect(s.ageYear(1, 2000)).toBe("1 year old · 2000");
    expect(s.ageYear(2, 2000)).toBe("2 years old · 2000");
    localStorage.setItem("earth:language", "ru");
    expect(s.title).toBe("Earth — симулятор одной жизни");
    expect(s.newLife).toBe("Новая жизнь");
  });

  it("переводит прямые строки и подставляет имя в шаблон", () => {
    expect(translateContent("Помириться первым")).toBe("Make up first");
    expect(translateContent("Ты поссорился с лучшим другом — Анна.")).toBe("You have fallen out with your best friend, Анна.");
  });

  it("переводит сохранённую сцену вместе с вложенным воспоминанием", () => {
    const translated = translateContent("Вы с Anna вспоминаете прошлое: «Ты подошёл сам. Пришлось наступить на гордость.». Теперь это видится иначе.");
    expect(translated).toBe("You and Anna recall the past: “You approach first. You have to swallow your pride.”. It looks different now.");
    expect(translated).not.toMatch(/[А-Яа-яЁё]/u);
  });

  it("переводит живую семейную сцену после подстановки памяти", () => {
    const { s: state } = newState("i18n-family-memory");
    state.age = 30;
    const parents = state.people.filter((person) => person.role === "mother" || person.role === "father");
    for (const parent of parents) {
      parent.name = "Anna";
      parent.memories.push({ age: 10, year: state.birth.year + 10, eventId: "school-friend-fight", text: "Ты подошёл сам. Пришлось наступить на гордость.", impact: 3, kind: "support" });
    }
    const event = FAMILY_EVENTS.find((item) => item.id === "family-parent-memory")!;
    const translated = translateContent(eventText(state, event));
    expect(translated).toBe("You and Anna recall the past: “You approach first. You have to swallow your pride.”. It looks different now.");
  });

  it("переводит новости семьи и питомцев", () => {
    expect(translateContent("Умерла мать Анна.")).toBe("Анна died.");
    expect(translateContent("Родилась сестра Анна.")).toBe("Sister Анна was born.");
    expect(translateContent("Анна: переезд и начало самостоятельной жизни.")).toBe("Анна: moving out and starting an independent life.");
    expect(translateContent("В семье появился питомец Чарли.")).toBe("Charlie joined the family.");
    expect(translateContent("Зефир ушёл из жизни после долгих лет вместе.")).toBe("Zephyr passed away after many years together.");
  });

  it("переводит планы, политику, наследие и узор жизни", () => {
    expect(translateContent("Завершён годовой план: jobSearch.")).toBe("Annual plan completed: job search.");
    expect(translateContent("Кампания уровня местный начата. Выборы: 2030.")).toBe("local campaign started. Election: 2030.");
    expect(translateContent("Победа на выборах: политический уровень национальный, платформа порядок.")).toBe("Election won: national political level, order platform.");
    expect(translateContent("Конституционная поправка принята через референдум: termLimit.")).toBe("Constitutional amendment passed by referendum: term limit.");
    expect(translateContent("Анна продолжает род после Борис. Поколение 3.")).toBe("Анна continues the lineage after Борис. Generation 3.");
    expect(translateContent("Новая жизнь в поколении 3. Наследие и семейная история сохранены.")).toBe("A new life in generation 3. Inheritance and family history preserved.");
    expect(translateContent("Узор жизни: твоя связь с Анна хранит уже больше двадцати лет общих воспоминаний.")).toBe("Life pattern: your bond with Анна already holds more than twenty years of shared memories.");
  });

  it("покрывает переводом все события, решения и исходы", () => {
    for (const event of [...ALL_EVENTS, ...FAMILY_EVENTS]) {
      expect(hasTranslation(event.text), event.id).toBe(true);
      for (const choice of event.choices) {
        expect(hasTranslation(choice.label), `${event.id}: ${choice.label}`).toBe(true);
        if (choice.outcome) expect(hasTranslation(choice.outcome), `${event.id}: ${choice.outcome}`).toBe(true);
        if (choice.risk) {
          expect(hasTranslation(choice.risk.successText), `${event.id}: risk success`).toBe(true);
          expect(hasTranslation(choice.risk.failText), `${event.id}: risk failure`).toBe(true);
        }
      }
    }
  });

  it("оставляет русский каталог неизменным на русском языке", () => {
    localStorage.setItem("earth:language", "ru");
    const text = "Ты поссорился с лучшим другом — Анна.";
    expect(translateContent(text)).toBe(text);
  });
});
