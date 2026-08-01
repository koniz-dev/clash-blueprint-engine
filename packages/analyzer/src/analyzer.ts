import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type GameRules,
  type Village,
} from "@clash/engine";
import { round } from "./geometry.js";
import { createDefaultMetrics } from "./metrics/index.js";
import { buildAnalysisContext } from "./model.js";
import type { DefenseScore, Grade, Metric, WeakPoint, WeakPointSeverity } from "./types.js";

const SEVERITY_ORDER: Record<WeakPointSeverity, number> = { critical: 0, weak: 1, info: 2 };

function gradeFor(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Scores a layout's defensive strength on a 0–100 scale by running a weighted
 * set of {@link Metric}s and aggregating their sub-scores and weak points.
 *
 * Metrics are injected (defaulting to {@link createDefaultMetrics}), so a
 * consumer — or a future plugin — can add, drop or reweight dimensions without
 * touching this class.
 */
export class LayoutAnalyzer {
  readonly #metrics: ReadonlyArray<Metric>;

  constructor(metrics: ReadonlyArray<Metric> = createDefaultMetrics()) {
    this.#metrics = metrics;
  }

  analyze(
    village: Village,
    catalog: BuildingCatalog,
    rules: GameRules = DEFAULT_GAME_RULES,
  ): DefenseScore {
    const context = buildAnalysisContext(village, catalog, rules);
    const results = this.#metrics.map((metric) => metric.evaluate(context));

    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const overall =
      totalWeight === 0
        ? 0
        : round(results.reduce((sum, r) => sum + r.score * r.weight, 0) / totalWeight);

    const weakPoints: WeakPoint[] = results
      .flatMap((r) => r.weakPoints)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    return { overall, grade: gradeFor(overall), metrics: results, weakPoints };
  }
}

/** Convenience: analyze with the default metric set. */
export function analyzeLayout(
  village: Village,
  catalog: BuildingCatalog,
  rules: GameRules = DEFAULT_GAME_RULES,
): DefenseScore {
  return new LayoutAnalyzer().analyze(village, catalog, rules);
}
