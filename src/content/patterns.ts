import type { LifeState } from "../core/state.ts";

export function detectPatterns(s: LifeState): string[] {
  const found: string[] = [];
  const add = (id: string, text: string) => {
    if (s.patterns.includes(id)) return;
    s.patterns.push(id);
    found.push(text);
  };
  const year = s.birth.year + s.age;
  const moves = s.chronicle.filter((entry) => (entry.source ?? "hero") === "hero" && /переезд|переехал|переехали/i.test(entry.text)).length;
  if (moves >= 3) add("third-move", "Узор жизни: уже третий переезд — новые места стали частью твоей истории.");
  const siblings = s.people.filter((p) => p.role === "sibling");
  if (siblings.length > 0 && siblings.every((p) => !p.alive)) {
    add("outlived-siblings", "Узор жизни: ты пережил всех братьев и сестёр. Их воспоминания остались в летописи рода.");
  }
  if (s.people.some((p) => p.role === "child" && p.alive) && s.people.some((p) => (p.role === "mother" || p.role === "father") && p.alive)) {
    add("three-generations", "Узор жизни: теперь рядом три поколения — твои родители, ты и твой ребёнок.");
  }
  if (s.people.filter((p) => p.role === "child").length >= 3) {
    add("three-children", "Узор жизни: трое детей, три разных истории и три разных отношения с тобой.");
  }
  for (const p of s.people) {
    const first = p.memories[0];
    if (first && p.memories.length >= 5 && year - first.year >= 20) {
      add(`long-bond-${p.id}`, `Узор жизни: твоя связь с ${p.name} хранит уже больше двадцати лет общих воспоминаний.`);
    }
  }
  return found;
}
