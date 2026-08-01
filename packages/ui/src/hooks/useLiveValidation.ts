import { useEffect, useState } from "react";
import type { BuildingCatalog, GameRules, Village, VillageEditor } from "@clash/engine";
import { ValidationEngine, type RuleSet, type ValidationReport } from "@clash/rules-engine";

/** Live count/allowance status for one building definition. */
export interface DefinitionStatus {
  readonly count: number;
  /** Allowed maximum from the rule pack, or `null` when the pack doesn't list it. */
  readonly max: number | null;
  /** Whether the current rule pack permits this building at all. */
  readonly allowed: boolean;
  /** Whether the building is unlocked at the pack's tier (`minTier ≤ tier`). */
  readonly unlocked: boolean;
  /** `true` once the placed count has reached the allowed maximum. */
  readonly atMax: boolean;
}

/** Inline severities we surface on the canvas (suggestions stay panel-only). */
export type InlineSeverity = "error" | "warning";

/** The reactively-derived validation view the editor renders. */
export interface LiveValidation {
  readonly report: ValidationReport | null;
  /** Building id → its most-severe inline severity (error wins over warning). */
  readonly severityById: ReadonlyMap<string, InlineSeverity>;
  /** Per definition id: current count vs. allowance + unlock status. */
  readonly perDefinition: ReadonlyMap<string, DefinitionStatus>;
}

const EMPTY: LiveValidation = {
  report: null,
  severityById: new Map(),
  perDefinition: new Map(),
};

const engine = new ValidationEngine();

/**
 * Pure derivation of the live-validation view from the current village + rule
 * pack. No React, no debounce — just the read model the UI needs, so the logic
 * is trivially testable. Uses the *pure* `ValidationEngine.validate` (which
 * records no event), safe to call on every change.
 */
export function deriveLiveValidation(
  village: Village,
  catalog: BuildingCatalog,
  ruleSet: RuleSet | undefined,
  rules: GameRules,
): LiveValidation {
  if (!ruleSet) return EMPTY;

  const report = engine.validate(village, ruleSet, catalog, rules);

  // Map each offending building id to the strongest inline severity.
  const severityById = new Map<string, InlineSeverity>();
  for (const issue of report.issues) {
    if (issue.severity !== "error" && issue.severity !== "warning") continue;
    for (const id of issue.subjects ?? []) {
      if (issue.severity === "error" || !severityById.has(id)) {
        severityById.set(id, issue.severity);
      }
    }
  }

  // Current placed count per definition.
  const counts = new Map<string, number>();
  for (const building of village.listBuildings()) {
    counts.set(building.definitionId, (counts.get(building.definitionId) ?? 0) + 1);
  }

  const perDefinition = new Map<string, DefinitionStatus>();
  for (const def of catalog.all()) {
    const allowance = ruleSet.allowances.get(def.id);
    const max = allowance ? allowance.maxCount : null;
    const count = counts.get(def.id) ?? 0;
    perDefinition.set(def.id, {
      count,
      max,
      allowed: allowance !== undefined,
      unlocked: def.minTier <= ruleSet.tier,
      atMax: max !== null && count >= max,
    });
  }

  return { report, severityById, perDefinition };
}

/**
 * Reactive, debounced live validation. Recomputes whenever the engine `version`
 * changes (the signal that the aggregate mutated), coalescing the Wall tool's
 * per-tile bursts into one pass. A thin projection — it never mutates anything.
 */
export function useLiveValidation(
  editor: VillageEditor,
  catalog: BuildingCatalog,
  rules: GameRules,
  ruleSet: RuleSet | undefined,
  version: number,
): LiveValidation {
  const [state, setState] = useState<LiveValidation>(() =>
    deriveLiveValidation(editor.village, catalog, ruleSet, rules),
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setState(deriveLiveValidation(editor.village, catalog, ruleSet, rules));
    }, 80);
    return () => clearTimeout(id);
    // `version` is the reactivity trigger: the village mutates in place (stable
    // identity), so the bumped counter is what tells us to recompute.
  }, [editor, catalog, rules, ruleSet, version]);

  return state;
}
