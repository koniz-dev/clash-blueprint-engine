import { useCallback, useState } from "react";

/** The three toggleable defensive overlays. */
export type OverlayKey = "coverage" | "compartments" | "deadZones";
export type OverlayPrefs = Record<OverlayKey, boolean>;

const DEFAULT: OverlayPrefs = { coverage: false, compartments: false, deadZones: false };
const STORAGE_KEY = "cbe:overlays";

function initialPrefs(): OverlayPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Record<OverlayKey, unknown>>;
    return {
      coverage: parsed.coverage === true,
      compartments: parsed.compartments === true,
      deadZones: parsed.deadZones === true,
    };
  } catch {
    return DEFAULT;
  }
}

/**
 * Overlay toggle state, off by default and persisted to `localStorage` (like the
 * locale/view prefs). Pure UI state — no game logic.
 */
export function useOverlayPrefs() {
  const [prefs, setPrefs] = useState<OverlayPrefs>(initialPrefs);

  const setOverlay = useCallback((key: OverlayKey, on: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: on };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const active = prefs.coverage || prefs.compartments || prefs.deadZones;
  return { prefs, setOverlay, active };
}
