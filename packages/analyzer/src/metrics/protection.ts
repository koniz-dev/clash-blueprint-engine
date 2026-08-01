import type { GridVec } from "@clash/shared";
import { centrality, directionOf, round } from "../geometry.js";
import type { AnalysisContext, Metric, MetricResult, WeakPoint } from "../types.js";

/** Fraction of the tiles ringing a building's footprint that are walls. */
function wallRingCoverage(context: AnalysisContext, buildingId: string): number {
  const instance = context.village.listBuildings().find((b) => b.id === buildingId);
  if (!instance) return 0;
  const wallTiles = new Set(
    context.village.listWalls().map((w) => `${w.position.x},${w.position.y}`),
  );
  const bounds = context.village.footprintOf(instance).bounds;
  const ring: GridVec[] = [];
  for (let x = bounds.x - 1; x <= bounds.x + bounds.width; x++) {
    ring.push({ x, y: bounds.y - 1 }, { x, y: bounds.y + bounds.height });
  }
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    ring.push({ x: bounds.x - 1, y }, { x: bounds.x + bounds.width, y });
  }
  const inBounds = ring.filter((t) => context.grid.containsTile(t));
  if (inBounds.length === 0) return 0;
  const walls = inBounds.filter((t) => wallTiles.has(`${t.x},${t.y}`));
  return walls.length / inBounds.length;
}

/**
 * Core-building protection: rewards a centred, walled core (the HQ designated by
 * the game's `coreCategory` — the Town Hall in Clash of Clans). A core on the
 * edge or in the open is the single biggest defensive liability. Messages use
 * the actual building's name, so they read naturally for any game.
 */
export const coreProtectionMetric: Metric = {
  id: "core-protection",
  label: "Core Building Protection",
  weight: 3,
  evaluate(context): MetricResult {
    const core = context.core;
    if (!core) {
      return {
        metricId: this.id,
        label: this.label,
        score: 0,
        weight: this.weight,
        details: { centrality: 0, wallCoverage: 0 },
        weakPoints: [
          {
            metricId: this.id,
            severity: "critical",
            message: "There is no core building in this layout.",
            recommendation: "Place the core building near the centre of the base.",
            area: "overall",
          },
        ],
      };
    }

    const central = centrality(core.center, context.grid);
    const wallCoverage = wallRingCoverage(context, core.id);
    const score = round(100 * (0.6 * central + 0.4 * wallCoverage));

    const weakPoints: WeakPoint[] = [];
    if (central < 0.5) {
      weakPoints.push({
        metricId: this.id,
        severity: central < 0.3 ? "critical" : "weak",
        message: `The ${core.name} sits toward the ${directionOf(core.center, context.center)} side, away from the core.`,
        recommendation: `Move the ${core.name} closer to the centre so attackers must break through more layers.`,
        area: directionOf(core.center, context.center),
        subjects: [core.id],
      });
    }
    if (wallCoverage < 0.5) {
      weakPoints.push({
        metricId: this.id,
        severity: "weak",
        message: `The ${core.name} is only ${Math.round(wallCoverage * 100)}% enclosed by walls.`,
        recommendation: `Surround the ${core.name} with a full wall ring.`,
        subjects: [core.id],
      });
    }

    return {
      metricId: this.id,
      label: this.label,
      score,
      weight: this.weight,
      details: { centrality: round(central, 2), wallCoverage: round(wallCoverage, 2) },
      weakPoints,
    };
  },
};

/** Storage protection: rewards keeping resource storages out of the outer ring. */
export const storageProtectionMetric: Metric = {
  id: "storage-protection",
  label: "Storage Protection",
  weight: 2,
  evaluate(context): MetricResult {
    if (context.storages.length === 0) {
      return {
        metricId: this.id,
        label: this.label,
        score: 100,
        weight: this.weight,
        details: { averageCentrality: 1, exposed: 0 },
        weakPoints: [
          {
            metricId: this.id,
            severity: "info",
            message: "No storages to protect.",
            area: "overall",
          },
        ],
      };
    }

    const centralities = context.storages.map((s) => centrality(s.center, context.grid));
    const average = centralities.reduce((a, b) => a + b, 0) / centralities.length;
    const exposed = context.storages.filter((s) => centrality(s.center, context.grid) < 0.4);

    const weakPoints: WeakPoint[] = exposed.map((s) => ({
      metricId: this.id,
      severity: "weak",
      message: `${s.name} is exposed on the ${directionOf(s.center, context.center)} edge.`,
      recommendation: `Pull ${s.name} into the core to slow resource raids.`,
      area: directionOf(s.center, context.center),
      subjects: [s.id],
    }));

    return {
      metricId: this.id,
      label: this.label,
      score: round(100 * average),
      weight: this.weight,
      details: { averageCentrality: round(average, 2), exposed: exposed.length },
      weakPoints,
    };
  },
};
