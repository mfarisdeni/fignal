import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LanguageContext,
  rememberLanguage,
  storedLanguage,
  translateIn,
  type LanguageContextValue,
} from "@/hooks/use-language";
import type { Language } from "@/lib/i18n";

/**
 * Language state for the whole app.
 *
 * English is the default and the fallback for every key, so a missing
 * translation can never leave a blank label. The choice is remembered per
 * device, and <html lang> follows it so screen readers switch voices with it.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState(storedLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    rememberLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translateIn(language, key, vars),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
