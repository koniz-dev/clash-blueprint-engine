import { analyzeLayout } from "@clash/analyzer";
import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type GameRules,
  type Village,
} from "@clash/engine";
import { createDefaultTroopCatalog, type TroopCatalog } from "@clash/simulation";
import { placementAdvisor } from "./advisors/placement.js";
import { simulationProbeAdvisor } from "./advisors/simulation-probe.js";
import { weakPointsAdvisor } from "./advisors/weak-points.js";
import { runAttackProbes, type ProbeOptions } from "./probes.js";
import type { Advisor, AdvisorContext, AiReport, RecommendationPriority } from "./types.js";

const PRIORITY_ORDER: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };

export function createDefaultAdvisors(): Advisor[] {
  return [weakPointsAdvisor, placementAdvisor, simulationProbeAdvisor];
}

export interface RecommendConfig {
  readonly troops?: TroopCatalog;
  /** Run attack probes (needed by the simulation advisor). Default true. */
  readonly simulate?: boolean;
  readonly probeOptions?: ProbeOptions;
  /** Game-specific rules (core category, roles, HP…). Defaults to Clash-like. */
  readonly rules?: GameRules;
}

/**
 * Composes the analyzer and the simulator into ranked, actionable
 * recommendations. Advisors are injected (defaulting to the heuristic set), so
 * an LLM- or vision-backed advisor is added by extending the list — the engine
 * itself never changes. This is the seam the "future LLM / computer vision"
 * support plugs into.
 */
export class RecommendationEngine {
  readonly #advisors: ReadonlyArray<Advisor>;

  constructor(advisors: ReadonlyArray<Advisor> = createDefaultAdvisors()) {
    this.#advisors = advisors;
  }

  recommend(village: Village, catalog: BuildingCatalog, config: RecommendConfig = {}): AiReport {
    const rules = config.rules ?? DEFAULT_GAME_RULES;
    const score = analyzeLayout(village, catalog, rules);
    const troops = config.troops ?? createDefaultTroopCatalog();
    const probes =
      config.simulate === false
        ? []
        : runAttackProbes(village, catalog, troops, config.probeOptions, rules);

    const context: AdvisorContext = { village, catalog, troops, rules, score, probes };
    const recommendations = this.#advisors
      .flatMap((advisor) => advisor.advise(context))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    return { defenseScore: score, recommendations, probes };
  }
}

/** Convenience: recommend with the default advisors and troop roster. */
export function recommendImprovements(
  village: Village,
  catalog: BuildingCatalog,
  config?: RecommendConfig,
): AiReport {
  return new RecommendationEngine().recommend(village, catalog, config);
}
