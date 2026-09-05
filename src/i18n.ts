/**
 * Tiny dictionary i18n. Source strings are Traditional Chinese (the keys);
 * other languages map key → translation. Missing entries fall back to the key,
 * so an untranslated string is visible instead of blank.
 *
 * t("已選 {n} 面牆", { n: 3 })  →  "3 walls selected"
 */
import { en } from "./i18n.en";

export type Lang = "zh-Hant" | "en";

let current: Lang = "zh-Hant";
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  listeners.forEach((l) => l());
}

export function onLangChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Map a Home Assistant language code to a UI language. */
export function langFromHass(code: string | undefined | null): Lang {
  if (!code) return "en";
  const c = code.toLowerCase();
  if (c.startsWith("zh")) return "zh-Hant";
  return "en";
}

const STORAGE = "dollhouse:lang";
export function readLangOverride(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE);
    return v === "en" || v === "zh-Hant" ? v : null;
  } catch {
    return null;
  }
}
export function writeLangOverride(lang: Lang | null) {
  try {
    if (lang) localStorage.setItem(STORAGE, lang);
    else localStorage.removeItem(STORAGE);
  } catch {
    /* ignore */
  }
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = current === "en" ? (en[key] ?? key) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
