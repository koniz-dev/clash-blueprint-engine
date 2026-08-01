import type { BuildingInstance } from "@clash/engine";
import type { ValidationContext, ValidationIssue, ValidationRule } from "./types.js";

/** Group placed buildings by their definition id. */
function countByDefinition(
  buildings: ReadonlyArray<BuildingInstance>,
): Map<string, BuildingInstance[]> {
  const grouped = new Map<string, BuildingInstance[]>();
  for (const building of buildings) {
    const bucket = grouped.get(building.definitionId);
    if (bucket) bucket.push(building);
    else grouped.set(building.definitionId, [building]);
  }
  return grouped;
}

function displayName(context: ValidationContext, definitionId: string): string {
  return context.catalog.get(definitionId)?.name ?? definitionId;
}

/** Required buildings must be present in the allowed quantity (e.g. one Town Hall). */
export const requiredBuildingsRule: ValidationRule = {
  id: "required-buildings",
  validate(context) {
    const grouped = countByDefinition(context.village.listBuildings());
    const issues: ValidationIssue[] = [];
    for (const requirement of context.ruleSet.required) {
      const count = grouped.get(requirement.definitionId)?.length ?? 0;
      const name = displayName(context, requirement.definitionId);
      if (count < requirement.min) {
        issues.push({
          ruleId: this.id,
          code: count === 0 ? "MISSING_REQUIRED" : "TOO_FEW_REQUIRED",
          severity: "error",
          message:
            requirement.min === 1
              ? `Missing required building: ${name}.`
              : `Requires at least ${requirement.min} ${name} (found ${count}).`,
        });
      } else if (requirement.max !== undefined && count > requirement.max) {
        issues.push({
          ruleId: this.id,
          code: "TOO_MANY_REQUIRED",
          severity: "error",
          message: `At most ${requirement.max} ${name} allowed (found ${count}).`,
          subjects: (grouped.get(requirement.definitionId) ?? []).map((b) => b.id),
        });
      }
    }
    return issues;
  },
};

/** Every placed building type must be permitted by the rule pack. */
export const buildingAllowedRule: ValidationRule = {
  id: "building-allowed",
  validate(context) {
    const issues: ValidationIssue[] = [];
    for (const [definitionId, instances] of countByDefinition(context.village.listBuildings())) {
      if (!context.ruleSet.allowances.has(definitionId)) {
        issues.push({
          ruleId: this.id,
          code: "NOT_ALLOWED",
          severity: "error",
          message: `${displayName(context, definitionId)} is not available at ${context.tierLabel} ${context.ruleSet.tier}.`,
          subjects: instances.map((b) => b.id),
        });
      }
    }
    return issues;
  },
};

/** No building type may exceed its max count for the current tier. */
export const buildingCountRule: ValidationRule = {
  id: "building-count",
  validate(context) {
    const issues: ValidationIssue[] = [];
    for (const [definitionId, instances] of countByDefinition(context.village.listBuildings())) {
      const allowance = context.ruleSet.allowances.get(definitionId);
      if (allowance && instances.length > allowance.maxCount) {
        issues.push({
          ruleId: this.id,
          code: "OVER_LIMIT",
          severity: "error",
          message: `Too many ${displayName(context, definitionId)}: ${instances.length}/${allowance.maxCount}.`,
          subjects: instances.map((b) => b.id),
        });
      }
    }
    return issues;
  },
};

/** Warn when a building requires a higher tier than the current one. */
export const tierRequirementRule: ValidationRule = {
  id: "tier-requirement",
  validate(context) {
    const issues: ValidationIssue[] = [];
    for (const building of context.village.listBuildings()) {
      const def = context.catalog.get(building.definitionId);
      if (def && def.minTier > context.ruleSet.tier) {
        issues.push({
          ruleId: this.id,
          code: "UNLOCKS_LATER",
          severity: "warning",
          message: `${def.name} unlocks at ${context.tierLabel} ${def.minTier}.`,
          subjects: [building.id],
        });
      }
    }
    return issues;
  },
};

/** Wall count must not exceed the pack limit; zero walls is a suggestion. */
export const wallLimitRule: ValidationRule = {
  id: "wall-limit",
  validate(context) {
    const count = context.village.wallCount;
    if (count > context.ruleSet.wallLimit) {
      return [
        {
          ruleId: this.id,
          code: "OVER_WALL_LIMIT",
          severity: "error",
          message: `Too many walls: ${count}/${context.ruleSet.wallLimit}.`,
        },
      ];
    }
    if (count === 0) {
      return [
        {
          ruleId: this.id,
          code: "NO_WALLS",
          severity: "suggestion",
          message: "This layout has no walls — defenses are fully exposed.",
        },
      ];
    }
    return [];
  },
};

/** Coordinates must be non-negative integers within the grid (guards imports). */
export const coordinateValidityRule: ValidationRule = {
  id: "coordinate-validity",
  validate(context) {
    const issues: ValidationIssue[] = [];
    const { grid } = context.village;
    for (const building of context.village.listBuildings()) {
      const { x, y } = building.position;
      if (!Number.isInteger(x) || !Number.isInteger(y) || !grid.containsTile({ x, y })) {
        issues.push({
          ruleId: this.id,
          code: "INVALID_COORDINATE",
          severity: "error",
          message: `${displayName(context, building.definitionId)} has an invalid position (${x}, ${y}).`,
          subjects: [building.id],
        });
      }
    }
    return issues;
  },
};

/** The default rule set, ordered most-severe concern first. */
export function createDefaultRules(): ValidationRule[] {
  return [
    coordinateValidityRule,
    requiredBuildingsRule,
    buildingAllowedRule,
    buildingCountRule,
    tierRequirementRule,
    wallLimitRule,
  ];
}
