import type { LifeEvent } from "../core/events.ts";
import { rngFromSeed } from "../core/rng.ts";

export function careerEvent(seed: string, education: number): LifeEvent {
  const rng = rngFromSeed(`${seed}:career-choice`);
  const tradition = education >= 25 && rng() < 0.5 ? "education" : "industry";
  const bonds = education >= 55 && rng() < 0.5 ? "medicine" : "agriculture";
  return {
    id: "after-school",
    minAge: 18,
    maxAge: 18,
    milestone: true,
    once: true,
    weight: 10,
    text: "Школа позади. Выбери профессиональное направление. Медицина и другие профессии также доступны позже через работу мечты в разделе «Образ жизни».",
    choices: [
      tradition === "education"
        ? { sector: "tradition", label: "Образование и преподавание", outcome: "Ты выбрал работу с людьми и знаниями. Доход скромнее, зато путь понятен.", effects: { health: 3, money: -2 }, career: "education" }
        : { sector: "tradition", label: "Промышленность и ремесло", outcome: "Ты устроился рядом с домом — спокойно и понятно. Роста меньше.", effects: { health: 3, money: -2 }, career: "industry" },
      { sector: "change", label: "Инженерия и техническая работа", outcome: "Переезд, учёба и новые люди. Дорого и вдали от своих.", effects: { education: 9, bonds: -5 }, career: "engineering" },
      {
        sector: "self",
        label: "Услуги и своё дело",
        outcome: "",
        career: "services",
        risk: {
          chance: 0.6,
          successText: "Своё дело пошло. Но ты всё делаешь сам, поддержки меньше.",
          successEffects: { money: 6, education: -3 },
          failText: "Своё дело не пошло, пришлось подрабатывать где придётся.",
          failEffects: { money: -3, education: -2 },
        },
      },
      bonds === "medicine"
        ? { sector: "bonds", label: "Медицина и забота", outcome: "Ты выбрал долгий путь учёбы и помощи людям. Свободного времени меньше.", effects: { bonds: 4, health: -2 }, career: "medicine" }
        : { sector: "bonds", label: "Сельское хозяйство", outcome: "Ты выбрал землю и физический труд. Погода и доход не всегда предсказуемы.", effects: { bonds: 3, health: -2 }, career: "agriculture" },
    ],
  };
}

export const AFTER_SCHOOL = careerEvent("default", 100);
