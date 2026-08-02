import type { BuildingDefinition } from "@clash/engine";
import { err, ok, type Result } from "@clash/shared";
import { z } from "zod";

/**
 * Runtime schemas for the external, human-edited JSON in `data/`. Parsing
 * happens once, at the boundary — everything past this module trusts the types.
 * A malformed data pack fails loudly here instead of corrupting a layout later.
 */

// `category` is an open string here; the *valid* set for a game is checked
// against that game's declared categories when a pack is loaded (see
// `game-definition.ts`), keeping the category system data-defined.
const categorySchema = z.string().min(1);

const positiveInt = z.number().int().positive();

export const buildingDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: categorySchema,
    width: positiveInt,
    height: positiveInt,
    hitbox: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
    minTier: z.number().int().positive(),
    attackRange: z.number().nonnegative().optional(),
    damageType: z.enum(["single", "splash", "none"]).optional(),
    targets: z.array(z.enum(["ground", "air"])).optional(),
    hitpoints: z.number().positive().optional(),
    damagePerSecond: z.number().nonnegative().optional(),
  })
  .strict();

export const buildingAllowanceSchema = z
  .object({
    id: z.string().min(1),
    maxCount: z.number().int().nonnegative(),
  })
  .strict();

export const requiredBuildingSchema = z
  .object({
    id: z.string().min(1),
    min: z.number().int().nonnegative().default(1),
    max: z.number().int().positive().optional(),
  })
  .strict();

// --- Spatial / design rules (optional, data-driven geometric constraints) ---

/** Select the buildings a spatial rule applies to — by definition id or category. */
const targetSelectorSchema = z.union([
  z.object({ id: z.string().min(1) }).strict(),
  z.object({ category: categorySchema }).strict(),
]);

/** How center-to-center tile distance is measured. `chebyshev` = king moves. */
const metricSchema = z.enum(["chebyshev", "manhattan", "euclidean"]);

const severitySchema = z.enum(["error", "warning", "suggestion"]);

/**
 * A single geometric constraint, discriminated by `type`. Each entry is pure
 * data; the validation engine turns it into layout findings with `subjects` so
 * offending buildings light up in the editor. Severity defaults are graded by
 * how hard the constraint usually is (spacing/edge/proximity warn, centering
 * suggests) and can always be overridden per entry.
 */
export const spatialRuleSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("minSpacing"),
      target: targetSelectorSchema,
      minDistance: positiveInt,
      metric: metricSchema.default("chebyshev"),
      severity: severitySchema.default("warning"),
    })
    .strict(),
  z
    .object({
      type: z.literal("edgeBuffer"),
      target: targetSelectorSchema.optional(),
      buffer: positiveInt,
      severity: severitySchema.default("warning"),
    })
    .strict(),
  z
    .object({
      type: z.literal("centered"),
      target: targetSelectorSchema,
      tolerance: positiveInt,
      severity: severitySchema.default("suggestion"),
    })
    .strict(),
  z
    .object({
      type: z.literal("proximity"),
      target: targetSelectorSchema,
      near: targetSelectorSchema,
      maxDistance: positiveInt,
      metric: metricSchema.default("chebyshev"),
      severity: severitySchema.default("warning"),
    })
    .strict(),
]);

export const rulePackSchema = z
  .object({
    tier: z.number().int().positive(),
    gridSize: positiveInt,
    walls: z.number().int().nonnegative(),
    buildings: z.array(buildingAllowanceSchema),
    required: z.array(requiredBuildingSchema).default([]),
    spatial: z.array(spatialRuleSchema).default([]),
  })
  .strict();

export type BuildingDefinitionJson = z.infer<typeof buildingDefinitionSchema>;
export type RulePackJson = z.infer<typeof rulePackSchema>;
/** A parsed spatial constraint (discriminated on `type`). */
export type SpatialRuleJson = z.infer<typeof spatialRuleSchema>;
/** Selects buildings for a spatial rule, by definition id or category. */
export type TargetSelector = z.infer<typeof targetSelectorSchema>;
export type DistanceMetric = z.infer<typeof metricSchema>;

/**
 * Normalize a parsed record into a `BuildingDefinition`. Optional keys are
 * included only when present so the result satisfies the engine's
 * `exactOptionalPropertyTypes` contract (no `key: undefined`).
 */
function toDefinition(d: BuildingDefinitionJson): BuildingDefinition {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    width: d.width,
    height: d.height,
    minTier: d.minTier,
    ...(d.hitbox !== undefined ? { hitbox: d.hitbox } : {}),
    ...(d.attackRange !== undefined ? { attackRange: d.attackRange } : {}),
    ...(d.damageType !== undefined ? { damageType: d.damageType } : {}),
    ...(d.targets !== undefined ? { targets: d.targets } : {}),
    ...(d.hitpoints !== undefined ? { hitpoints: d.hitpoints } : {}),
    ...(d.damagePerSecond !== undefined ? { damagePerSecond: d.damagePerSecond } : {}),
  };
}

export interface ParseError {
  readonly source: string;
  readonly issues: ReadonlyArray<string>;
}

export function flattenZodError(source: string, error: z.ZodError): ParseError {
  return {
    source,
    issues: error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`),
  };
}

export function parseBuildingDefinition(
  json: unknown,
  source = "building-definition",
): Result<BuildingDefinition, ParseError> {
  const parsed = buildingDefinitionSchema.safeParse(json);
  return parsed.success
    ? ok(toDefinition(parsed.data))
    : err(flattenZodError(source, parsed.error));
}

export function parseBuildingDefinitions(
  json: unknown,
  source = "building-definitions",
): Result<BuildingDefinition[], ParseError> {
  const asArray = z.array(z.unknown()).safeParse(json);
  if (!asArray.success) {
    return err({ source, issues: ["expected an array of building definitions"] });
  }
  const defs: BuildingDefinition[] = [];
  for (let i = 0; i < asArray.data.length; i++) {
    const one = parseBuildingDefinition(asArray.data[i], `${source}[${i}]`);
    if (!one.ok) return one;
    defs.push(one.value);
  }
  return ok(defs);
}

export function parseRulePack(
  json: unknown,
  source = "rule-pack",
): Result<RulePackJson, ParseError> {
  const parsed = rulePackSchema.safeParse(json);
  return parsed.success ? ok(parsed.data) : err(flattenZodError(source, parsed.error));
}
