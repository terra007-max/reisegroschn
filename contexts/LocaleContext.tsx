"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Locale } from "@/lib/translations";
import { translations } from "@/lib/translations";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  tr: (path: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "de",
  setLocale: () => {},
  tr: (path) => path,
});

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // Persist in cookie (1 year)
    document.cookie = `evodia_locale=${l}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const tr = useCallback(
    (path: string): string => {
      const parts = path.split(".");
      let obj: unknown = translations[locale];
      for (const part of parts) {
        if (obj && typeof obj === "object" && part in (obj as Record<string, unknown>)) {
          obj = (obj as Record<string, unknown>)[part];
        } else {
          return path;
        }
      }
      return typeof obj === "string" ? obj : path;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, tr }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
