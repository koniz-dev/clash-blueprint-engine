import { clamp01, round } from "../geometry.js";
import type { AnalysisContext, Metric, MetricResult, WeakPoint } from "../types.js";

/** How many of a village's defenses sit inside a closed compartment. */
function enclosedDefenseRatio(context: AnalysisContext): number {
  if (context.defenses.length === 0) return 0;
  const enclosed = new Set<string>();
  for (const compartment of context.compartments.compartments) {
    for (const id of compartment.buildingIds) enclosed.add(id);
  }
  const inside = context.defenses.filter((d) => enclosed.has(d.id)).length;
  return inside / context.defenses.length;
}

/**
 * Wall efficiency: walls should form connected barriers that actually enclose
 * defenses, not sit as scattered, wasted segments.
 */
export const wallEfficiencyMetric: Metric = {
  id: "wall-efficiency",
  label: "Wall Efficiency",
  weight: 1,
  evaluate(context): MetricResult {
    const { wallCount, isolatedWallCount } = context.compartments;
    if (wallCount === 0) {
      return {
        metricId: this.id,
        label: this.label,
        score: 0,
        weight: this.weight,
        details: { walls: 0, isolated: 0, enclosedDefenseRatio: 0 },
        weakPoints: [
          {
            metricId: this.id,
            severity: "weak",
            message: "This base has no walls.",
            recommendation: "Add walls to compartmentalize the base and slow ground troops.",
            area: "overall",
          },
        ],
      };
    }

    const contiguity = clamp01(1 - isolatedWallCount / wallCount);
    const enclosedRatio = enclosedDefenseRatio(context);
    const score = round(100 * (0.5 * contiguity + 0.5 * enclosedRatio));

    const weakPoints: WeakPoint[] = [];
    if (isolatedWallCount > 0) {
      weakPoints.push({
        metricId: this.id,
        severity: "weak",
        message: `${isolatedWallCount} wall segment(s) are isolated and seal nothing.`,
        recommendation: "Connect stray walls into closed compartments.",
      });
    }

    return {
      metricId: this.id,
      label: this.label,
      score,
      weight: this.weight,
      details: {
        walls: wallCount,
        isolated: isolatedWallCount,
        enclosedDefenseRatio: round(enclosedRatio, 2),
      },
      weakPoints,
    };
  },
};

/**
 * Compartment quality: a strong base splits defenses across several closed
 * compartments and wastes no walls on empty "dead zones".
 */
export const compartmentQualityMetric: Metric = {
  id: "compartment-quality",
  label: "Compartment Quality",
  weight: 2,
  evaluate(context): MetricResult {
    const { compartments } = context.compartments;
    const withBuildings = compartments.filter((c) => c.buildingIds.length > 0);
    const deadZones = compartments.filter((c) => c.isDeadZone);

    if (compartments.length === 0) {
      return {
        metricId: this.id,
        label: this.label,
        score: 0,
        weight: this.weight,
        details: { compartments: 0, deadZones: 0 },
        weakPoints: [
          {
            metricId: this.id,
            severity: "weak",
            message: "There are no closed compartments — walls do not fully enclose any area.",
            recommendation: "Close wall rings so they form sealed compartments.",
            area: "overall",
          },
        ],
      };
    }

    // Reward up to ~4 useful compartments; penalize dead zones.
    const usefulScore = clamp01(withBuildings.length / 4);
    const deadPenalty = clamp01(deadZones.length / Math.max(1, compartments.length));
    const score = round(100 * clamp01(usefulScore * (1 - 0.5 * deadPenalty)));

    const weakPoints: WeakPoint[] = deadZones.map((zone) => ({
      metricId: this.id,
      severity: "info",
      message: `A walled dead zone of ${zone.tiles.length} empty tiles protects nothing.`,
      recommendation: "Fill the dead zone with a building or remove its walls.",
    }));
    if (withBuildings.length === 1) {
      weakPoints.push({
        metricId: this.id,
        severity: "weak",
        message: "All protected buildings share a single compartment.",
        recommendation:
          "Split defenses across multiple compartments so one breach doesn't expose everything.",
        area: "center",
      });
    }

    return {
      metricId: this.id,
      label: this.label,
      score,
      weight: this.weight,
      details: {
        compartments: compartments.length,
        withBuildings: withBuildings.length,
        deadZones: deadZones.length,
      },
      weakPoints,
    };
  },
};
