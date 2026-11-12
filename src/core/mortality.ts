import type { Rng } from "./rng.ts";
import type { MortData, Sex } from "./types.ts";

export const MAX_AGE = 100;

function qAt(mort: MortData, sex: Sex, year: number, age: number): number {
  const lastYear = 1950 + mort.q[sex].length - 1;
  const y = Math.min(Math.max(year, 1950), lastYear);
  return mort.q[sex][y - 1950][age] / mort.scale;
}

function a0FromM(m0: number, sex: Sex): number {
  if (sex === "M") {
    return m0 < 0.023 ? 0.14929 - 1.99545 * m0 : m0 < 0.08307 ? 0.02832 + 3.26201 * m0 : 0.29915;
  }
  return m0 < 0.01724 ? 0.14903 - 2.05527 * m0 : m0 < 0.06891 ? 0.04667 + 3.88089 * m0 : 0.31411;
}

/** Средняя доля последнего года жизни: 0.5, для младенцев — Andreev & Kingkade (2015),
 *  m0 восстанавливается из q0 итерацией q = m / (1 + (1 - a0) * m). */
function lastYearFraction(q: number, sex: Sex, age: number): number {
  if (age > 0) return 0.5;
  let m = q;
  for (let i = 0; i < 8; i++) m = q / (1 - (1 - a0FromM(m, sex)) * m);
  return a0FromM(m, sex);
}

/** Периодная таблица: весь жизненный путь по смертности одного года. Для теста против e0.
 *  Возвращает дробную продолжительность жизни; целый возраст смерти — Math.floor. */
export function deathAgePeriod(rng: Rng, mort: MortData, sex: Sex, year: number): number {
  for (let age = 0; age <= MAX_AGE; age++) {
    const q = qAt(mort, sex, year, age);
    if (rng() < q) return age + lastYearFraction(q, sex, age);
  }
  return MAX_AGE + 0.5;
}

/** Когортная жизнь: в возрасте a действует таблица года birthYear + a; после 2100 — таблица 2100. */
export function deathAgeCohort(rng: Rng, mort: MortData, sex: Sex, birthYear: number): number {
  for (let age = 0; age <= MAX_AGE; age++) {
    const q = qAt(mort, sex, birthYear + age, age);
    if (rng() < q) return age + lastYearFraction(q, sex, age);
  }
  return MAX_AGE + 0.5;
}
