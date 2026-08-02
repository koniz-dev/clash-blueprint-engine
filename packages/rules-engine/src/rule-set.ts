import {
  InMemoryBuildingCatalog,
  type BuildingCatalog,
  type BuildingDefinition,
} from "@clash/engine";
import type { RulePackJson, SpatialRuleJson } from "./schema.js";

/** A geometric constraint carried on the rule set (see {@link SpatialRuleJson}). */
export type SpatialRule = SpatialRuleJson;

/** Max allowed count of a building type at a given Town Hall level. */
export interface BuildingAllowance {
  readonly definitionId: string;
  readonly maxCount: number;
}

/** A building that must be present (e.g. exactly one Town Hall). */
export interface RequiredBuilding {
  readonly definitionId: string;
  readonly min: number;
  readonly max?: number;
}

/**
 * The parsed, indexed form of a rule pack that the validation engine consumes.
 * Built once from JSON so validation is pure lookups, not repeated array scans.
 */
export interface RuleSet {
  readonly tier: number;
  readonly gridSize: number;
  readonly wallLimit: number;
  readonly allowances: ReadonlyMap<string, BuildingAllowance>;
  readonly required: ReadonlyArray<RequiredBuilding>;
  /** Optional geometric constraints; empty for packs that declare none. */
  readonly spatial: ReadonlyArray<SpatialRule>;
}

export function buildRuleSet(pack: RulePackJson): RuleSet {
  const allowances = new Map<string, BuildingAllowance>();
  for (const entry of pack.buildings) {
    allowances.set(entry.id, { definitionId: entry.id, maxCount: entry.maxCount });
  }
  const required: RequiredBuilding[] = pack.required.map((r) =>
    r.max === undefined
      ? { definitionId: r.id, min: r.min }
      : { definitionId: r.id, min: r.min, max: r.max },
  );
  return {
    tier: pack.tier,
    gridSize: pack.gridSize,
    wallLimit: pack.walls,
    allowances,
    required,
    spatial: pack.spatial,
  };
}

/** Build the engine's `BuildingCatalog` port from validated definitions. */
export function buildCatalog(definitions: Iterable<BuildingDefinition>): BuildingCatalog {
  return new InMemoryBuildingCatalog(definitions);
}
