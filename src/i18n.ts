export type Language = "ru" | "en";
const KEY = "earth:language";

export function getLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
  }
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(KEY, language);
  } catch {
  }
  document.documentElement.lang = language;
}
