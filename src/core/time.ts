import type { ConflictData } from "./conflicts.ts";
import type { FamilyData, MortData, NamesData } from "./types.ts";
import type { PoliticsData } from "./politics.ts";
import type { LifeState } from "./state.ts";
import { accumulateFocusTick } from "./focus.ts";
import { advanceYear } from "./turn.ts";
import { TICKS_PER_YEAR } from "../content/focus.ts";

export function advanceTimeTick(
  s: LifeState,
  mort: MortData,
  family: FamilyData,
  names: NamesData,
  conflicts?: ConflictData,
  gdpPerCapita?: number,
  politicsData?: PoliticsData,
): boolean {
  if (!s.alive) return false;
  accumulateFocusTick(s);
  if (s.time.tick < TICKS_PER_YEAR) return false;
  advanceYear(s, mort, family, names, conflicts, gdpPerCapita, politicsData);
  return true;
}
