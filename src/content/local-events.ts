import { climateForCountry } from "./climates.ts";
import type { LifeEvent } from "../core/events.ts";

export const LOCAL_EVENTS: LifeEvent[] = [
  {
    id: "north-first-snow", minAge: 5, maxAge: 12, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "north",
    text: "Выпал первый снег. Двор превращается в белую пустыню. Что ты будешь делать?",
    choices: [
      { sector: "bonds", label: "Лепить снеговика со всеми", outcome: "Получился огромный снеговик и новый общий ритуал. Пальцы замёрзли.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Уйти в тепло с книгой", outcome: "Тёплая комната и интересная история, но общие игры прошли мимо.", effects: { money: 3, education: -2 } },
      { sector: "tradition", label: "Устроить снежную крепость", outcome: "Крепость стоит до весны. На её строительство ушли силы и время.", effects: { health: 3, money: -2 } },
      { sector: "change", label: "Придумать новую игру", outcome: "Правила придуманы тобой и быстро меняются. Взрослым они кажутся странными.", effects: { education: 2, bonds: -1 } },
    ],
  },
  {
    id: "north-ice-road", minAge: 16, maxAge: 60, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "north",
    text: "Дорога покрылась льдом, а дела не ждут. Как доберёшься?",
    choices: [
      { sector: "tradition", label: "Идти привычной дорогой", outcome: "Ты дошёл вовремя, но несколько падений напомнят о себе.", effects: { health: 3, money: -2 } },
      { sector: "change", label: "Найти другой маршрут", outcome: "Дорога длиннее, зато безопаснее. День на работе потерян частично.", effects: { education: 2, bonds: -1 } },
      { sector: "bonds", label: "Пойти вместе с соседями", outcome: "Вместе идти спокойнее и веселее, но пришлось подстроиться под чужой темп.", effects: { bonds: 2, health: -1 } },
      { sector: "self", label: "Остаться дома", outcome: "Ты сохранил здоровье, но пропустил дела и подвёл ожидания.", effects: { money: 3, education: -2 } },
    ],
  },
  {
    id: "north-long-winter", minAge: 40, maxAge: 100, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "north",
    text: "Зима затянулась. Световой день короткий, а привычные дела идут медленнее. Как проведёшь сезон?",
    choices: [
      { sector: "bonds", label: "Собираться за общим столом", outcome: "Длинные разговоры скрашивают зиму, хотя приходится отвлекаться от своих планов.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Заняться тихим делом", outcome: "Порядок и одиночество помогают пережить сезон, но общения стало меньше.", effects: { money: 3, education: -2 } },
      { sector: "tradition", label: "Соблюдать зимний режим", outcome: "Режим поддерживает силы, но любая спонтанность исчезает.", effects: { health: 2, money: -1 } },
      { sector: "change", label: "Сменить обстановку", outcome: "Небольшое путешествие возвращает энергию и требует расходов.", effects: { education: 3, bonds: -2 } },
    ],
  },
  {
    id: "temperate-spring-garden", minAge: 5, maxAge: 17, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "temperate",
    text: "Весной земля мягкая, а семья спорит, что посадить. Что выберешь ты?",
    choices: [
      { sector: "tradition", label: "То, что сажали всегда", outcome: "Привычные грядки получаются лучше всех, но нового опыта меньше.", effects: { health: 2, money: -1 } },
      { sector: "change", label: "Новое растение", outcome: "Не всё прижилось, зато ты понял причины и записал наблюдения.", effects: { education: 2, bonds: -1 } },
      { sector: "bonds", label: "Работать вместе", outcome: "Грядки закончены быстро, а спор превратился в общий разговор.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Своя маленькая грядка", outcome: "Ты отвечаешь за свой уголок, но помощь принимать непросто.", effects: { money: 2, education: -1 } },
    ],
  },
  {
    id: "temperate-rain-harvest", minAge: 16, maxAge: 65, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "temperate",
    text: "Дожди задерживают уборку. Нужно решить, что спасать в первую очередь.",
    choices: [
      { sector: "tradition", label: "Завершить привычный план", outcome: "Основное сделано, но дождливая работа забрала силы.", effects: { health: 3, money: -2 } },
      { sector: "change", label: "Изменить порядок работ", outcome: "Часть планов пришлось перестроить, зато меньше потерь.", effects: { education: 2, bonds: -1 } },
      { sector: "bonds", label: "Позвать на помощь", outcome: "Работа спорится вместе, но ты чувствуешь себя обязанным.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Сделать только своё", outcome: "Ты справился в одиночку и устал, не дожидаясь поддержки.", effects: { money: 3, education: -2 } },
    ],
  },
  {
    id: "temperate-city-park", minAge: 40, maxAge: 100, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "temperate",
    text: "Парк после дождя особенно тихий. Предлагают прогулку, а у тебя ещё много дел.",
    choices: [
      { sector: "bonds", label: "Пойти с близкими", outcome: "Прогулка и разговор укрепляют отношения, но часть дел ждёт до вечера.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Пройтись в одиночку", outcome: "Тишина возвращает силы, хотя общее время с семьёй сократилось.", effects: { money: 2, education: -1 } },
      { sector: "tradition", label: "Сначала закончить дела", outcome: "Дисциплина сохранена, но прогулка так и осталась отложенной.", effects: { health: 2, money: -1 } },
      { sector: "change", label: "Пойти другим маршрутом", outcome: "Новая дорога оказалась длиннее и интереснее обычной, но усталость больше.", effects: { education: 2, bonds: -1 } },
    ],
  },
  {
    id: "tropics-rain-season", minAge: 5, maxAge: 17, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "tropics",
    text: "Ливень шумит по крыше, и обычные игры приходится перенести домой. Что придумаешь?",
    choices: [
      { sector: "bonds", label: "Играть всей семьёй", outcome: "Дом наполняется смехом, но спокойного времени для уроков меньше.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Слушать дождь и читать", outcome: "Ты узнаёшь много нового, но остаёшься в стороне от общих игр.", effects: { money: 3, education: -2 } },
      { sector: "tradition", label: "Повторить знакомую игру", outcome: "Знакомые правила успокаивают, но нового ничего не произошло.", effects: { health: 2, money: -1 } },
      { sector: "change", label: "Изучить ливень", outcome: "Ты записываешь воду и ветер как настоящий исследователь. Взрослые ворчат на лужи.", effects: { education: 2, bonds: -1 } },
    ],
  },
  {
    id: "tropics-heat-work", minAge: 16, maxAge: 65, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "tropics",
    text: "Жара усиливается, а сроки не меняются. Как организуешь день?",
    choices: [
      { sector: "tradition", label: "Работать в жару", outcome: "Всё сделано вовремя, но здоровье пострадало от перегрева.", effects: { health: 3, money: -2 } },
      { sector: "change", label: "Перенести дела на раннее утро", outcome: "Пришлось изменить режим и встать очень рано, зато работа безопаснее.", effects: { education: 1, bonds: -1 } },
      { sector: "bonds", label: "Разделить работу", outcome: "Каждый взял небольшую часть, и усталость стала общей, а не твоей.", effects: { bonds: 2, health: -1 } },
      { sector: "self", label: "Сделать перерыв", outcome: "Ты восстановил силы, но часть денег и ожиданий потеряна.", effects: { money: 3, education: -2 } },
    ],
  },
  {
    id: "tropics-monsoon", minAge: 40, maxAge: 100, once: true, weight: 1.3,
    condition: (s) => climateForCountry(s.birth.country.iso3) === "tropics",
    text: "Сезон дождей задерживается. Дом требует внимания, а силы уже не те, что раньше.",
    choices: [
      { sector: "tradition", label: "Справиться привычным способом", outcome: "Опыт помогает, но работа всё равно забирает здоровье.", effects: { health: 3, money: -2 } },
      { sector: "change", label: "Подготовить дом заранее", outcome: "Новый порядок требует вложений, зато меньше сюрпризов.", effects: { education: 2, bonds: -1 } },
      { sector: "bonds", label: "Попросить семью помочь", outcome: "Дом в порядке, а ты принимаешь помощь без ложной гордости.", effects: { bonds: 3, health: -2 } },
      { sector: "self", label: "Сделать только необходимое", outcome: "Ты сохранил силы, но часть хозяйства осталась незавершённой.", effects: { money: 2, education: -1 } },
    ],
  },
];
