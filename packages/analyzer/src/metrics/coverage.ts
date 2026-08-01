import type { Vec2 } from "@clash/shared";
import { coverageRatio, directionOf, isCovered, round } from "../geometry.js";
import type { AnalysisContext, Direction, Metric, MetricResult, WeakPoint } from "../types.js";
import { DIRECTIONS } from "../types.js";

/** Coverage of building centres by defenses that can hit a given target layer. */
function layerCoverage(
  context: AnalysisContext,
  select: (d: { targetsAir: boolean; targetsGround: boolean }) => boolean,
): number {
  const targets: Vec2[] = context.buildings.map((b) => b.center);
  return coverageRatio(targets, context.defenses, (d) => select(d));
}

/** Per-direction coverage, so weak points can name the exposed side. */
function coverageByDirection(
  context: AnalysisContext,
  select: (d: { targetsAir: boolean; targetsGround: boolean }) => boolean,
): Map<Direction, { total: number; covered: number }> {
  const buckets = new Map<Direction, { total: number; covered: number }>(
    DIRECTIONS.map((d) => [d, { total: 0, covered: 0 }]),
  );
  for (const building of context.buildings) {
    const dir = directionOf(building.center, context.center);
    const bucket = buckets.get(dir)!;
    bucket.total++;
    if (isCovered(building.center, context.defenses, (d) => select(d))) bucket.covered++;
  }
  return buckets;
}

function makeCoverageMetric(
  id: string,
  label: string,
  layerWord: string,
  select: (d: { targetsAir: boolean; targetsGround: boolean }) => boolean,
  noDefenseMessage: string,
): Metric {
  return {
    id,
    label,
    weight: 2,
    evaluate(context): MetricResult {
      const relevantDefenses = context.defenses.filter((d) => select(d));
      if (relevantDefenses.length === 0) {
        return {
          metricId: id,
          label,
          score: 0,
          weight: this.weight,
          details: { coverage: 0, defenses: 0 },
          weakPoints: [
            {
              metricId: id,
              severity: "critical",
              message: noDefenseMessage,
              recommendation: `Add ${layerWord} defenses.`,
              area: "overall",
            },
          ],
        };
      }

      const coverage = layerCoverage(context, select);
      const weakPoints: WeakPoint[] = [];
      for (const [dir, bucket] of coverageByDirection(context, select)) {
        if (bucket.total >= 2 && bucket.covered / bucket.total < 0.5) {
          weakPoints.push({
            metricId: id,
            severity: "weak",
            message: `The ${dir} side has weak ${layerWord} defense coverage (${bucket.covered}/${bucket.total} buildings covered).`,
            recommendation: `Reposition or add a ${layerWord} defense to cover the ${dir} approach.`,
            area: dir,
          });
        }
      }

      return {
        metricId: id,
        label,
        score: round(100 * coverage),
        weight: this.weight,
        details: { coverage: round(coverage, 2), defenses: relevantDefenses.length },
        weakPoints,
      };
    },
  };
}

/** Share of the base within reach of an air-targeting defense. */
export const airCoverageMetric = makeCoverageMetric(
  "air-coverage",
  "Air Defense Coverage",
  "air",
  (d) => d.targetsAir,
  "This base has no air defenses — it is wide open to dragons and other air troops.",
);

/** Share of the base within reach of a ground-targeting defense. */
export const groundCoverageMetric = makeCoverageMetric(
  "ground-coverage",
  "Ground Defense Coverage",
  "ground",
  (d) => d.targetsGround,
  "This base has no ground defenses.",
);

/**
 * Attack entry points: each cardinal side of the base should be defended. A
 * side with buildings but no damaging defense covering it is an open lane.
 */
export const entryPointsMetric: Metric = {
  id: "entry-points",
  label: "Attack Entry Points",
  weight: 1,
  evaluate(context): MetricResult {
    const anyDefense = (): boolean => true;
    const buckets = coverageByDirection(context, anyDefense);
    const populated = [...buckets.entries()].filter(([, b]) => b.total > 0);
    if (populated.length === 0) {
      return {
        metricId: this.id,
        label: this.label,
        score: 0,
        weight: this.weight,
        details: { openSides: 0, sides: 0 },
        weakPoints: [],
      };
    }

    const openSides = populated.filter(([, b]) => b.covered === 0);
    const score = round(100 * (1 - openSides.length / populated.length));
    const weakPoints: WeakPoint[] = openSides.map(([dir]) => ({
      metricId: this.id,
      severity: "weak",
      message: `The ${dir} side is an open entry point — no defense covers troops attacking from there.`,
      recommendation: `Add a defense covering the ${dir} approach.`,
      area: dir,
    }));

    return {
      metricId: this.id,
      label: this.label,
      score,
      weight: this.weight,
      details: { openSides: openSides.length, sides: populated.length },
      weakPoints,
    };
  },
};
