import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { en, type MessageKey, type Messages } from "./messages";
import { vi } from "./vi";

export type { MessageKey, Messages };
export type Locale = "en" | "vi";

export const LOCALES: readonly Locale[] = ["en", "vi"];
const CATALOGS: Record<Locale, Messages> = { en, vi };

export interface I18n {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  /** Translate a key; falls back to the key itself if somehow missing. */
  readonly t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18n | null>(null);

const STORAGE_KEY = "cbe:locale";

function initialLocale(defaultLocale: Locale): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "vi" ? saved : defaultLocale;
}

export function I18nProvider({
  children,
  defaultLocale = "en",
}: {
  children: ReactNode;
  defaultLocale?: Locale;
}): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale(defaultLocale));

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18n>(() => {
    const catalog = CATALOGS[locale];
    return { locale, setLocale, t: (key) => catalog[key] ?? key };
  }, [locale, setLocale]);

  return createElement(I18nContext.Provider, { value }, children);
}

/**
 * Access the current locale and translator. Outside a provider it falls back to
 * English with a no-op setter, so components render standalone (e.g. in tests
 * and Storybook) without a provider.
 */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { locale: "en", setLocale: () => {}, t: (key) => en[key] ?? key };
}
