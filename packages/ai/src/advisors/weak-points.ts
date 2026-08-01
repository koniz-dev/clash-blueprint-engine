import type { WeakPointSeverity } from "@clash/analyzer";
import type {
  Advisor,
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "../types.js";

const PRIORITY_BY_SEVERITY: Record<WeakPointSeverity, RecommendationPriority> = {
  critical: "high",
  weak: "medium",
  info: "low",
};

/** Positioning metrics are handled by the placement advisor with concrete moves. */
const HANDLED_ELSEWHERE = new Set(["core-protection", "storage-protection"]);

const CATEGORY_BY_METRIC: Record<string, RecommendationCategory> = {
  "air-coverage": "coverage",
  "ground-coverage": "coverage",
  "entry-points": "coverage",
  "wall-efficiency": "walls",
  "compartment-quality": "compartments",
};

/**
 * Translates the analyzer's located weak points into recommendations. This is
 * the cheap, always-available advisor — no simulation, no search — that surfaces
 * everything the static analysis already found, as actionable guidance.
 */
export const weakPointsAdvisor: Advisor = {
  id: "weak-points",
  advise(context): Recommendation[] {
    const scoreByMetric = new Map(context.score.metrics.map((m) => [m.metricId, m.score]));
    const recommendations: Recommendation[] = [];
    let counter = 0;

    for (const weak of context.score.weakPoints) {
      if (HANDLED_ELSEWHERE.has(weak.metricId)) continue;
      const category = CATEGORY_BY_METRIC[weak.metricId] ?? "general";
      const metricScore = scoreByMetric.get(weak.metricId);
      recommendations.push({
        id: `weak-points-${++counter}`,
        advisorId: this.id,
        category,
        priority: PRIORITY_BY_SEVERITY[weak.severity],
        title: weak.message,
        detail: weak.recommendation ?? weak.message,
        rationale:
          metricScore !== undefined
            ? `Metric "${weak.metricId}" scored ${metricScore}/100${weak.area ? `; weakest on the ${weak.area} side` : ""}.`
            : `Flagged by the ${weak.metricId} check.`,
        ...(weak.subjects ? { subjects: weak.subjects } : {}),
      });
    }

    return recommendations;
  },
};
