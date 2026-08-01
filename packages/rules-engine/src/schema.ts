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

export const rulePackSchema = z
  .object({
    tier: z.number().int().positive(),
    gridSize: positiveInt,
    walls: z.number().int().nonnegative(),
    buildings: z.array(buildingAllowanceSchema),
    required: z.array(requiredBuildingSchema).default([]),
  })
  .strict();

export type BuildingDefinitionJson = z.infer<typeof buildingDefinitionSchema>;
export type RulePackJson = z.infer<typeof rulePackSchema>;

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
