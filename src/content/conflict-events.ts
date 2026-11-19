import type { LifeEvent } from "../core/events.ts";
import type { ConflictPhase } from "../core/conflicts.ts";

const TEXT: Record<string, string> = {
  start: "Организованное насилие началось в стране. Опасность входит в твою повседневную жизнь.",
  escalation: "Насилие усилилось: прежние правила безопасности уже не работают.",
  deescalation: "Насилие ослабло. Можно восстанавливать дом и привычную жизнь, но риск не исчез полностью.",
  end: "Активная фаза насилия завершилась. Нужно решить, как возвращаться к жизни.",
};

function event(phase: "start" | "escalation", adult: boolean): LifeEvent {
  return {
    id: `war-${phase}${adult ? "" : "-civilian"}`,
    minAge: 0,
    maxAge: 100,
    conflict: true,
    crisis: true,
    heavy: true,
    weight: 10,
    subject: "closest",
    text: TEXT[phase],
    choices: [
      adult
        ? { sector: "tradition", label: "Остаться и защитить дом", outcome: "Ты остался. Дом и привычная жизнь стоят дорого.", effects: { health: 3, money: -2 }, action: "protectPeople" }
        : { sector: "tradition", label: "Укрыться и сохранять быт", outcome: "Ты выбрал укрытие и осторожность. Расходы и тревога остались.", effects: { health: 2, money: -1 } },
      { sector: "change", label: "Эвакуироваться с близкими", outcome: "Вы переместились вместе. Деньги и привычный дом остались позади.", effects: { education: 4, bonds: -2 }, action: "evacuateTogether" },
      { sector: "bonds", label: "Защищать близких", outcome: "Ты принял больше риска на себя. Близкие запомнят это.", effects: { bonds: 4, health: -2 }, action: "protectPeople" },
      adult
        ? { sector: "self", label: "Принять боевую роль", outcome: "Ты выбрал участие в боевых действиях. Это даёт средства, но смертельно опасно.", effects: { money: 3, education: -2 }, action: "combat" }
        : { sector: "self", label: "Эвакуироваться одному", outcome: "Ты ушёл один и снизил свой риск. Близкие остались в опасности.", effects: { money: 4, education: -2 }, action: "evacuateAlone" },
    ],
  };
}

function recovery(phase: "deescalation" | "end"): LifeEvent {
  return {
    id: `war-${phase}`,
    minAge: 0,
    maxAge: 100,
    conflict: true,
    crisis: true,
    heavy: true,
    weight: 10,
    subject: "closest",
    text: TEXT[phase],
    choices: [
      { sector: "tradition", label: "Восстанавливать дом", outcome: "Ты начал восстановление. Это требует денег и времени.", effects: { health: 3, money: -2 }, action: "civilianAid" },
      { sector: "change", label: "Выбрать новое безопасное место", outcome: "Ты закрепился в безопасном месте. Пришлось заново налаживать быт.", effects: { education: 2, bonds: -1 }, action: "evacuateTogether" },
      { sector: "bonds", label: "Помогать восстанавливаться вместе", outcome: "Вы помогаете друг другу. Свободных средств меньше.", effects: { bonds: 3, health: -2 }, action: "civilianAid" },
      { sector: "self", label: "Дать себе время", outcome: "Ты остановился, чтобы восстановиться. Накопления уменьшились.", effects: { money: 3, education: -2 } },
    ],
  };
}

export const CONFLICT_EVENTS: LifeEvent[] = [
  event("start", true),
  event("start", false),
  event("escalation", true),
  event("escalation", false),
  recovery("deescalation"),
  recovery("end"),
];

export function conflictEventForPhase(phase: ConflictPhase, adult: boolean): LifeEvent | null {
  if (phase === "ongoing" || phase === "peace") return null;
  const id = phase === "start" || phase === "escalation" ? `war-${phase}${adult ? "" : "-civilian"}` : `war-${phase}`;
  return CONFLICT_EVENTS.find((event) => event.id === id) ?? null;
}
