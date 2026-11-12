import type { LifeEvent } from "../../core/events.ts";

export const CHILDHOOD: LifeEvent[] = [
  {
    id: "early-health",
    minAge: 0,
    maxAge: 5,
    once: true,
    weight: 2,
    text: "Этой зимой ты болеешь чаще обычного.",
    choices: [
      { sector: "tradition", label: "Домашний уход и спокойный режим", outcome: "Тёплый дом и режим делают своё дело — ты окреп.", effects: { health: 5 } },
      { sector: "change", label: "Новый врач и обследование", outcome: "Обследование нашло причину, лечение помогло.", effects: { money: -3, health: 8 } },
    ],
  },
  {
    id: "toddler-games",
    minAge: 2,
    maxAge: 5,
    weight: 3,
    text: "Двор полон детей. Мама зовёт тебя играть с ними.",
    choices: [
      { sector: "bonds", label: "Играть с другими детьми", outcome: "Ты влезаешь в игры двора и находишь первых друзей.", effects: { bonds: 5 } },
      { sector: "self", label: "Остаться со своими игрушками", outcome: "Ты строишь свои миры в одиночку — и тебе там интересно.", effects: { education: 3 } },
    ],
  },
  {
    id: "first-words",
    minAge: 1,
    maxAge: 3,
    once: true,
    weight: 4,
    text: "Ты учишься говорить. Все ждут первое слово.",
    choices: [
      { sector: "bonds", label: "«Мама!»", outcome: "Мама плачет от счастья. Тебя обнимают весь вечер.", effects: { bonds: 4 } },
      { sector: "self", label: "Назвать любимую игрушку", outcome: "Первое слово — имя игрушки. Родители смеются.", effects: { education: 2 } },
    ],
  },
  {
    id: "daycare",
    minAge: 3,
    maxAge: 5,
    once: true,
    weight: 3,
    text: "Родители собираются отдать тебя в детский сад.",
    choices: [
      { sector: "tradition", label: "Пойти в садик", outcome: "Первые дни со слезами, потом — друзья и занятия.", effects: { bonds: 4, education: 2 } },
      { sector: "self", label: "Остаться дома с бабушкой", outcome: "Бабушкины сказки и пирожки вместо садика.", effects: { bonds: 3 } },
    ],
  },
  {
    id: "sibling",
    minAge: 2,
    maxAge: 5,
    once: true,
    weight: 2,
    text: "В семье родился братик или сестрёнка.",
    choices: [
      { sector: "bonds", label: "Любить и помогать", outcome: "Ты возишься с малышом и гордишься собой.", effects: { bonds: 6 } },
      { sector: "self", label: "Ревновать", outcome: "Внимание делят на двоих, и тебе это не нравится.", effects: { bonds: -4 } },
    ],
  },
  {
    id: "picky-eater",
    minAge: 2,
    maxAge: 5,
    weight: 2,
    text: "Ты отказываешься от еды, кроме любимой.",
    choices: [
      { sector: "tradition", label: "Слушаться родителей", outcome: "Каша и суп вернулись в твою жизнь. Здоровье крепнет.", effects: { health: 4 } },
      { sector: "self", label: "Только любимое", outcome: "Победа за тобой, но питание так себе.", effects: { health: -2 } },
    ],
  },
  {
    id: "bedtime-story",
    minAge: 2,
    maxAge: 5,
    weight: 3,
    text: "Вечер. Что перед сном?",
    choices: [
      { sector: "bonds", label: "Сказка с родителями", outcome: "Голос мамы, страницы с картинками — лучший ритуал дня.", effects: { bonds: 4, education: 2 } },
      { sector: "self", label: "Мультики", outcome: "Ещё одна серия — и сон.", effects: { education: 1 } },
    ],
  },
  {
    id: "playground-fall",
    minAge: 3,
    maxAge: 5,
    once: true,
    weight: 2,
    text: "Ты упал с качелей. Коленка в кровь.",
    choices: [
      { sector: "self", label: "Встать и дальше играть", outcome: "Ты отряхнулся и полез снова. Царапина заживёт.", effects: { health: 2 } },
      { sector: "bonds", label: "Заплакать и бежать к маме", outcome: "Мама подула на коленку и обняла. Уже не больно.", effects: { bonds: 3 } },
    ],
  },
  {
    id: "curious-questions",
    minAge: 3,
    maxAge: 5,
    once: true,
    weight: 3,
    text: "Ты задаёшь сто вопросов в день: почему небо? зачем спать?",
    choices: [
      { sector: "self", label: "Спрашивать обо всём", outcome: "Ответы рождают новые вопросы. Так и растёшь.", effects: { education: 5 } },
      { sector: "tradition", label: "Принимать как есть", outcome: "«Так устроен мир» — тебя это вполне устраивает.", effects: { education: 1, bonds: 2 } },
    ],
  },
  {
    id: "sharing-toys",
    minAge: 3,
    maxAge: 5,
    weight: 2,
    text: "Другой ребёнок хочет твою игрушку. Прямо сейчас.",
    choices: [
      { sector: "bonds", label: "Поделиться", outcome: "Вы играете вместе — так даже веселее.", effects: { bonds: 4 } },
      { sector: "self", label: "Не отдавать", outcome: "Игрушка осталась твоей. Играешь один.", effects: { bonds: -2 } },
    ],
  },
];
