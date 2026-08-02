import { useEffect, useState } from "react";
import type { BuildingCatalog, GameRules, Village, VillageEditor } from "@clash/engine";
import { analyzeLayout, type DefenseScore, type Direction } from "@clash/analyzer";

/** Weak-point severities we surface inline (analyzer "info" stays panel-only). */
export type WeakSeverity = "critical" | "weak";

/** A weak point's area: a compass side, the centre, or the base as a whole. */
export type WeakArea = Direction | "center" | "overall";

/** The reactively-derived analysis view the editor renders. */
export interface LiveAnalysis {
  readonly score: DefenseScore | null;
  /** Building id → its strongest inline weak severity (critical wins over weak). */
  readonly weakById: ReadonlyMap<string, WeakSeverity>;
  /** Area → its strongest inline weak severity (for directional markers). */
  readonly byArea: ReadonlyMap<WeakArea, WeakSeverity>;
}

const EMPTY: LiveAnalysis = {
  score: null,
  weakById: new Map(),
  byArea: new Map(),
};

const RANK: Record<WeakSeverity, number> = { critical: 2, weak: 1 };

/** Keep the stronger of two inline severities. */
function stronger(a: WeakSeverity | undefined, b: WeakSeverity): WeakSeverity {
  return a === undefined || RANK[b] > RANK[a] ? b : a;
}

/**
 * Pure derivation of the live-analysis view from the current village. No React,
 * no debounce — just the read model the UI needs, so the logic is trivially
 * testable. Uses the *pure* `analyzeLayout` (no side effects), safe to call on
 * every change. An empty village yields no score (nothing to grade yet).
 */
export function deriveLiveAnalysis(
  village: Village,
  catalog: BuildingCatalog,
  rules: GameRules,
): LiveAnalysis {
  if (village.buildingCount === 0) return EMPTY;

  const score = analyzeLayout(village, catalog, rules);

  const weakById = new Map<string, WeakSeverity>();
  const byArea = new Map<WeakArea, WeakSeverity>();
  for (const wp of score.weakPoints) {
    if (wp.severity !== "critical" && wp.severity !== "weak") continue;
    for (const id of wp.subjects ?? []) {
      weakById.set(id, stronger(weakById.get(id), wp.severity));
    }
    if (wp.area !== undefined) {
      byArea.set(wp.area, stronger(byArea.get(wp.area), wp.severity));
    }
  }

  return { score, weakById, byArea };
}

/**
 * Reactive, debounced live analysis. Recomputes whenever the engine `version`
 * changes (the signal that the aggregate mutated). The debounce is longer than
 * live validation's (~200ms vs. 80ms): `analyzeLayout` evaluates every metric
 * plus a compartment flood-fill, so we let the Wall tool's per-tile burst settle
 * into a single pass rather than analyzing on every painted tile. A thin
 * projection — it never mutates anything.
 */
export function useLiveAnalysis(
  editor: VillageEditor,
  catalog: BuildingCatalog,
  rules: GameRules,
  version: number,
): LiveAnalysis {
  const [state, setState] = useState<LiveAnalysis>(() =>
    deriveLiveAnalysis(editor.village, catalog, rules),
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setState(deriveLiveAnalysis(editor.village, catalog, rules));
    }, 200);
    return () => clearTimeout(id);
    // `version` is the reactivity trigger: the village mutates in place (stable
    // identity), so the bumped counter is what tells us to recompute.
  }, [editor, catalog, rules, version]);

  return state;
}
