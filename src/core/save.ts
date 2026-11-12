import type { LifeState } from "./state.ts";

const KEY = "earth:life:v1";

export function saveLife(s: LifeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // переполненное хранилище не должно ронять игру
  }
}

export function loadLife(): LifeState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LifeState;
    s.recentEvents ??= [];
    s.compass.choices ??= 0;
    return s;
  } catch {
    return null;
  }
}

export function clearLife(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
