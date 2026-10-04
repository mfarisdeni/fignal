import { createContext, useContext } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  translate,
  type Language,
  type MessageKey,
  type MessageVars,
} from "@/lib/i18n";

/**
 * Language context and the hook that reads it.
 *
 * Kept apart from the provider component so each file exports one kind of
 * thing: this one exports no component at all.
 */

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, vars?: MessageVars) => string;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

/** The remembered choice, or English when there is nothing usable stored. */
export function storedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === "id" || saved === "en" ? saved : DEFAULT_LANGUAGE;
  } catch {
    /* private mode - fall back to the default */
    return DEFAULT_LANGUAGE;
  }
}

/** Remembered per device; a failed write still applies for this session. */
export function rememberLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}

/** Look up a message in the active language. */
export function translateIn(
  language: Language,
  key: MessageKey,
  vars?: MessageVars,
): string {
  return translate(language, key, vars);
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
