import type { BuildingInstance } from "@clash/engine";
import type { DistanceMetric, TargetSelector } from "../schema.js";
import type { ValidationContext, ValidationIssue, ValidationRule } from "./types.js";

/** Continuous point in tile space (footprint centers land on half-tiles). */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Center of a placed building's footprint bounding box, in tile space. */
function centerOf(context: ValidationContext, building: BuildingInstance): Point {
  const { bounds } = context.village.footprintOf(building);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Distance between two points under the selected tile metric. */
function distance(a: Point, b: Point, metric: DistanceMetric): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  switch (metric) {
    case "chebyshev":
      return Math.max(dx, dy);
    case "manhattan":
      return dx + dy;
    case "euclidean":
      return Math.hypot(dx, dy);
  }
}

/** Does a building match a selector (by definition id or by category)? */
function matches(
  context: ValidationContext,
  building: BuildingInstance,
  selector: TargetSelector,
): boolean {
  if ("id" in selector) return building.definitionId === selector.id;
  return context.catalog.get(building.definitionId)?.category === selector.category;
}

function select(
  context: ValidationContext,
  selector: TargetSelector,
): ReadonlyArray<BuildingInstance> {
  return context.village.listBuildings().filter((b) => matches(context, b, selector));
}

/** Human label for a selector, preferring a catalog name for id selectors. */
function selectorLabel(context: ValidationContext, selector: TargetSelector): string {
  if ("id" in selector) return context.catalog.get(selector.id)?.name ?? selector.id;
  return selector.category;
}

/** Offending ids, sorted and de-duplicated, for stable output and highlighting. */
function subjectsOf(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

/**
 * Buildings of a target set must be at least `minDistance` tiles apart
 * (center-to-center). Every building in a too-close pair is a subject.
 */
export const spatialMinSpacingRule: ValidationRule = {
  id: "spatial-min-spacing",
  validate(context) {
    const issues: ValidationIssue[] = [];
    for (const rule of context.ruleSet.spatial) {
      if (rule.type !== "minSpacing") continue;
      const targets = select(context, rule.target);
      const centers = targets.map((b) => centerOf(context, b));
      const tooClose = new Set<string>();
      for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
          if (distance(centers[i]!, centers[j]!, rule.metric) < rule.minDistance) {
            tooClose.add(targets[i]!.id);
            tooClose.add(targets[j]!.id);
          }
        }
      }
      if (tooClose.size === 0) continue;
      const label = selectorLabel(context, rule.target);
      issues.push({
        ruleId: this.id,
        code: "TOO_CLOSE",
        severity: rule.severity,
        message: `${label} must be at least ${rule.minDistance} tiles apart (${tooClose.size} too close).`,
        subjects: subjectsOf(tooClose),
      });
    }
    return issues;
  },
};

/**
 * No building (optionally only those matching `target`) may sit within `buffer`
 * tiles of the grid edge. Any building whose footprint enters the border band
 * is a subject.
 */
export const spatialEdgeBufferRule: ValidationRule = {
  id: "spatial-edge-buffer",
  validate(context) {
    const issues: ValidationIssue[] = [];
    const { grid } = context.village;
    for (const rule of context.ruleSet.spatial) {
      if (rule.type !== "edgeBuffer") continue;
      const candidates = rule.target
        ? select(context, rule.target)
        : context.village.listBuildings();
      const offenders = new Set<string>();
      for (const building of candidates) {
        const { cells } = context.village.footprintOf(building);
        const inBand = cells.some(
          (c) =>
            c.x < rule.buffer ||
            c.y < rule.buffer ||
            c.x >= grid.width - rule.buffer ||
            c.y >= grid.height - rule.buffer,
        );
        if (inBand) offenders.add(building.id);
      }
      if (offenders.size === 0) continue;
      const label = rule.target ? selectorLabel(context, rule.target) : "Buildings";
      issues.push({
        ruleId: this.id,
        code: "NEAR_EDGE",
        severity: rule.severity,
        message: `${label} must stay at least ${rule.buffer} tiles from the grid edge (${offenders.size} too close).`,
        subjects: subjectsOf(offenders),
      });
    }
    return issues;
  },
};

/**
 * A target building must sit within `tolerance` tiles (Chebyshev) of the grid
 * center. Each off-center target is a subject.
 */
export const spatialCenteredRule: ValidationRule = {
  id: "spatial-centered",
  validate(context) {
    const issues: ValidationIssue[] = [];
    const { grid } = context.village;
    const gridCenter: Point = { x: grid.width / 2, y: grid.height / 2 };
    for (const rule of context.ruleSet.spatial) {
      if (rule.type !== "centered") continue;
      const offenders = new Set<string>();
      for (const building of select(context, rule.target)) {
        const d = distance(centerOf(context, building), gridCenter, "chebyshev");
        if (d > rule.tolerance) offenders.add(building.id);
      }
      if (offenders.size === 0) continue;
      const label = selectorLabel(context, rule.target);
      issues.push({
        ruleId: this.id,
        code: "OFF_CENTER",
        severity: rule.severity,
        message: `${label} should sit within ${rule.tolerance} tiles of the grid center.`,
        subjects: subjectsOf(offenders),
      });
    }
    return issues;
  },
};

/**
 * Each target building must have a `near` building within `maxDistance` tiles.
 * Targets with no qualifying neighbour (or none at all) are subjects.
 */
export const spatialProximityRule: ValidationRule = {
  id: "spatial-proximity",
  validate(context) {
    const issues: ValidationIssue[] = [];
    for (const rule of context.ruleSet.spatial) {
      if (rule.type !== "proximity") continue;
      const targets = select(context, rule.target);
      const anchors = select(context, rule.near).map((b) => centerOf(context, b));
      const offenders = new Set<string>();
      for (const building of targets) {
        const from = centerOf(context, building);
        const nearest = anchors.reduce(
          (min, a) => Math.min(min, distance(from, a, rule.metric)),
          Number.POSITIVE_INFINITY,
        );
        if (nearest > rule.maxDistance) offenders.add(building.id);
      }
      if (offenders.size === 0) continue;
      const targetLabel = selectorLabel(context, rule.target);
      const nearLabel = selectorLabel(context, rule.near);
      issues.push({
        ruleId: this.id,
        code: "TOO_FAR",
        severity: rule.severity,
        message: `${targetLabel} must be within ${rule.maxDistance} tiles of ${nearLabel}.`,
        subjects: subjectsOf(offenders),
      });
    }
    return issues;
  },
};

/**
 * The data-driven spatial rules, in declaration order. Each reads its instances
 * from `context.ruleSet.spatial`, so a pack that declares none produces no
 * findings — the rules are inert on legacy packs.
 */
export function spatialRules(): ValidationRule[] {
  return [spatialMinSpacingRule, spatialEdgeBufferRule, spatialCenteredRule, spatialProximityRule];
}
