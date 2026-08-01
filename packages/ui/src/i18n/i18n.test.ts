// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { en } from "./messages";
import { vi as viCatalog } from "./vi";
import { I18nProvider, useI18n } from "./index";

describe("i18n catalogs", () => {
  it("every locale defines exactly the English keys (no missing/extra)", () => {
    expect(Object.keys(viCatalog).sort()).toEqual(Object.keys(en).sort());
    // No empty translations.
    for (const value of Object.values(viCatalog)) expect(value.length).toBeGreaterThan(0);
  });
});

describe("useI18n", () => {
  beforeEach(() => window.localStorage.clear());

  it("falls back to English with a no-op setter outside a provider", () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.locale).toBe("en");
    expect(result.current.t("toolbar.new")).toBe(en["toolbar.new"]);
    expect(() => result.current.setLocale("vi")).not.toThrow();
  });

  it("switches locale and persists it", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(I18nProvider, null, children);
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.t("toolbar.new")).toBe("New");
    act(() => result.current.setLocale("vi"));
    expect(result.current.locale).toBe("vi");
    expect(result.current.t("toolbar.new")).toBe(viCatalog["toolbar.new"]);
    expect(window.localStorage.getItem("cbe:locale")).toBe("vi");
  });

  it("restores the saved locale on mount", () => {
    window.localStorage.setItem("cbe:locale", "vi");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(I18nProvider, null, children);
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("vi");
  });
});
