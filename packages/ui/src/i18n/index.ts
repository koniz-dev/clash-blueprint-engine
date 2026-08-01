import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { en, type MessageKey, type Messages } from "./messages";
import { vi } from "./vi";

export type { MessageKey, Messages };
export type Locale = "en" | "vi";

export const LOCALES: readonly Locale[] = ["en", "vi"];
const CATALOGS: Record<Locale, Messages> = { en, vi };

/** Message keys for the well-known building categories (open set → optional). */
const CATEGORY_KEYS: Record<string, MessageKey> = {
  defense: "category.defense",
  resource: "category.resource",
  storage: "category.storage",
  army: "category.army",
  trap: "category.trap",
  wall: "category.wall",
  townhall: "category.townhall",
};

/** The message key for a category, or `null` for a game-defined one (show raw). */
export function categoryMessageKey(category: string): MessageKey | null {
  return CATEGORY_KEYS[category] ?? null;
}

/** Values interpolated into a message's `{name}` placeholders. */
export type MessageParams = Record<string, string | number>;

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export interface I18n {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  /**
   * Translate a key, filling `{name}` placeholders from `params`. Falls back to
   * the key itself if somehow missing.
   */
  readonly t: (key: MessageKey, params?: MessageParams) => string;
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
    return { locale, setLocale, t: (key, params) => interpolate(catalog[key] ?? key, params) };
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
  return { locale: "en", setLocale: () => {}, t: (key, params) => interpolate(en[key] ?? key, params) };
}
