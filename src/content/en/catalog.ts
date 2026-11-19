import { getLanguage } from "../../i18n.ts";
import { CHILDHOOD_EN } from "./childhood.ts";
import { SCHOOL_EN } from "./school.ts";
import { TEEN_EN } from "./teen.ts";
import { YOUTH_EN } from "./youth.ts";
import { ADULT_EN } from "./adult.ts";
import { SENIOR_EN } from "./senior.ts";
import { FAMILY_EN } from "./family.ts";
import { SPECIAL_EVENTS_EN } from "./special-events.ts";
import { HISTORY_EN } from "./history.ts";
import { CORE_EN, DYNAMIC_EN } from "./dynamic.ts";

export const EN_CONTENT: Record<string, string> = { ...CHILDHOOD_EN, ...SCHOOL_EN, ...TEEN_EN, ...YOUTH_EN, ...ADULT_EN, ...SENIOR_EN, ...FAMILY_EN, ...SPECIAL_EVENTS_EN, ...HISTORY_EN, ...CORE_EN };

interface DynamicPattern {
  regex: RegExp;
  names: string[];
  template: string;
  source: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const dynamicPatterns: DynamicPattern[] = Object.entries(EN_CONTENT).filter(([source]) => source.includes("{")).map(([source, template]) => {
  const names = [...source.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]);
  const parts = source.split(/\{[a-zA-Z]+\}/g).map(escapeRegex);
  return { regex: new RegExp(`^${parts.join("(.+?)")}$`), names, template, source };
}).sort((a, b) => b.source.length - a.source.length);

export function translateContent(text: string): string {
  if (getLanguage() === "ru") return text;
  const direct = EN_CONTENT[text];
  if (direct) return direct;
  for (const pattern of DYNAMIC_EN) {
    const match = pattern.regex.exec(text);
    if (match) return pattern.replace(...match.slice(1));
  }
  for (const pattern of dynamicPatterns) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    return pattern.template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => {
      const index = pattern.names.indexOf(name);
      if (index < 0) return placeholder;
      const value = match[index + 1];
      if (value === "успех") return "success";
      if (value === "неудача") return "failure";
      if (value === "близкий человек") return "a loved one";
      if (value === "пока нет общих воспоминаний") return "no shared memories yet";
      return translateContent(value);
    });
  }
  return text;
}

export function hasTranslation(text: string): boolean {
  if (EN_CONTENT[text]) return true;
  if (DYNAMIC_EN.some((pattern) => pattern.regex.test(text))) return true;
  return dynamicPatterns.some((pattern) => pattern.regex.test(text));
}
