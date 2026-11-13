import type { LifeEvent } from "../core/events.ts";

interface Crisis {
  year: number;
  countries: string[];
  text: string;
}

const CRISES: Crisis[] = [
  { year: 1971, countries: ["PAK", "BGD"], text: "Война и раздел: Восточный Пакистан становится Бангладеш." },
  { year: 1991, countries: ["RUS", "UKR", "BLR", "UZB", "KAZ", "GEO", "AZE", "LTU", "MDA", "LVA", "KGZ", "TJK", "ARM", "TKM", "EST"], text: "Распад СССР. Твоя страна теперь другая — и жизнь вокруг меняется." },
  { year: 1991, countries: ["SVN", "HRV", "BIH", "MKD"], text: "Распад Югославии. Твоя республика становится независимой." },
  { year: 1993, countries: ["CZE", "SVK"], text: "Чехословакия мирно разделилась на два государства." },
  { year: 1993, countries: ["ETH", "ERI"], text: "Эритрея официально отделилась от Эфиопии." },
  { year: 2006, countries: ["SRB", "MNE"], text: "Сербия и Черногория разделились на два государства." },
  { year: 2011, countries: ["SDN", "SSD"], text: "Судан разделился: Южный Судан стал независимым." },
];

export function crisisEvents(): LifeEvent[] {
  return CRISES.map((c) => ({
    id: `crisis-${c.year}-${c.countries[0]}`,
    minAge: 0,
    maxAge: 100,
    crisis: true,
    once: true,
    weight: 100,
    condition: (s) => s.birth.year + s.age === c.year && c.countries.includes(s.birth.country.iso3),
    text: c.text,
    choices: [
      {
        sector: "tradition",
        label: "Остаться и строить жизнь здесь",
        outcome: "Ты остался. Непростые годы, но это твой дом.",
        effects: { bonds: 4, money: -6 },
      },
      {
        sector: "change",
        label: "Уехать в другую страну",
        outcome: "",
        risk: {
          chance: 0.6,
          successText: "Эмиграция удалась: новая страна, новые возможности.",
          successEffects: { money: 6, bonds: -4 },
          failText: "Эмиграция далась тяжело: потери и тоска.",
          failEffects: { money: -8, bonds: -6 },
        },
      },
      {
        sector: "bonds",
        label: "Держаться вместе с близкими",
        outcome: "Семья пережила перемены вместе. Это главное. Сил и денег ушло много.",
        effects: { bonds: 6, money: -4 },
      },
      {
        sector: "self",
        label: "Пережить в одиночку",
        outcome: "Ты закрылся и справился сам. Близкие остались за дверью.",
        effects: { education: 3, bonds: -5 },
      },
    ],
  }));
}
