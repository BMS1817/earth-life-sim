import { clampScale } from "./state.ts";
import type { FocusId, HobbyId, LifeState } from "./state.ts";
import { bondsSummary, remember, relationshipOf } from "./people.ts";
import { FOCUS_PROFILES, HOBBY_LEVEL_XP, TICKS_PER_YEAR } from "../content/focus.ts";

export function focusOptions(s: LifeState): FocusId[] {
  return (Object.keys(FOCUS_PROFILES) as FocusId[]).filter((id) => {
    const profile = FOCUS_PROFILES[id];
    return s.age >= profile.minAge && (!profile.requiresHobby || s.hobbies.length > 0) && (!profile.requiresCareer || s.finance.career !== null);
  });
}

export function setFocus(s: LifeState, id: FocusId): void {
  if (focusOptions(s).includes(id)) s.focus.current = id;
}

export function addHobby(s: LifeState, id: HobbyId): void {
  if (s.age < 5 || s.hobbies.length >= 3 || s.hobbies.some((hobby) => hobby.id === id)) return;
  s.hobbies.push({ id, xp: 0, level: 0 });
  s.activeHobbyId ??= id;
}

export function setActiveHobby(s: LifeState, id: HobbyId): void {
  if (s.hobbies.some((hobby) => hobby.id === id)) s.activeHobbyId = id;
}

export function accumulateFocusTick(s: LifeState): void {
  const fraction = 1 / TICKS_PER_YEAR;
  s.focus.fractions[s.focus.current] = (s.focus.fractions[s.focus.current] ?? 0) + fraction;
  s.time.tick++;
}

function applyHobbyProgress(s: LifeState, focusId: FocusId, fraction: number): void {
  const profile = FOCUS_PROFILES[focusId];
  for (const hobby of s.hobbies) {
    if (hobby.level >= 10) continue;
    const active = hobby.id === s.activeHobbyId;
    const xp = (active ? profile.hobbyXp : 0.05) * fraction;
    hobby.xp += xp;
    const previous = hobby.level;
    let next = previous;
    for (let level = 1; level <= 10; level++) {
      if (hobby.xp >= HOBBY_LEVEL_XP[level]) next = level;
    }
    hobby.level = next;
    for (const milestone of [3, 6, 10]) {
      if (previous >= milestone || next < milestone) continue;
      const text = milestone === 3 ? "Первый турнир по увлечению" : milestone === 6 ? "Региональный турнир по увлечению" : "Мастерство в увлечении";
      s.chronicle.push({ age: s.age, year: s.birth.year + s.age, text: `${text}: ${hobby.id}.`, source: "hero" });
      s.happiness = clampScale(s.happiness + (milestone === 3 ? 1 : milestone === 6 ? 2 : 3));
    }
  }
}

export function completeFocusYear(s: LifeState): void {
  const fractions = Object.entries(s.focus.fractions).filter(([, value]) => value > 0);
  const total = fractions.reduce((sum, [, value]) => sum + value, 0);
  const weighted: [FocusId, number][] = total > 0
    ? fractions.map(([id, value]) => [id as FocusId, value / total])
    : [[s.focus.current, 1]];
  for (const [id, fraction] of weighted) {
    s.focusTotals[id] = (s.focusTotals[id] ?? 0) + fraction;
    const profile = FOCUS_PROFILES[id];
    s.happiness = clampScale(s.happiness + profile.happiness * fraction);
    s.scales.health = clampScale(s.scales.health + profile.health * fraction);
    s.scales.education = clampScale(s.scales.education + profile.education * fraction);
    s.scales.money = clampScale(s.scales.money + profile.money * fraction);
    if (profile.bonds !== 0) {
      const closest = s.people.filter((p) => p.alive && p.status === "active").sort((a, b) => relationshipOf(b) - relationshipOf(a) || a.id.localeCompare(b.id))[0];
      if (closest) {
        const text = profile.bonds > 0 ? "Год был посвящён близким." : "Время на близких пришлось сократить.";
        remember(closest, s.age, s.birth.year + s.age, `focus-${id}`, text, profile.bonds * fraction, profile.bonds > 0 ? "care" : "conflict");
      }
    }
    s.focus.careerPoints += profile.careerPoints * fraction;
    applyHobbyProgress(s, id, fraction);
  }
  if (s.focus.careerPoints >= 3 && s.finance.career && s.finance.employment === "employed" && s.finance.careerLevel < 5) {
    s.finance.careerLevel++;
    s.focus.careerPoints -= 3;
    s.chronicle.push({ age: s.age, year: s.birth.year + s.age, text: "Новый уровень в профессии благодаря ежегодному фокусу.", source: "hero" });
  }
  s.focus.careerPoints = Math.min(3, s.focus.careerPoints);
  s.happiness = clampScale(s.happiness + (60 - s.happiness) * 0.1);
  s.scales.bonds = bondsSummary(s.people);
  s.focus.fractions = {};
  s.time.tick = 0;
}
