import type { GameRules } from "@clash/engine";
import { err, ok, type Result } from "@clash/shared";
import { z } from "zod";
import { flattenZodError, type ParseError } from "./schema.js";

/**
 * A game pack's manifest (`game.json`) ties together everything that makes a
 * layout game concrete: the progression axis label, the declared building
 * categories (open set), the designated core/HQ, and wall stats. Adding a game
 * is adding one of these plus data — no engine code changes.
 */

const categoryDescriptorSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    order: z.number().int().optional(),
    /** Movement: does a building of this category block ground troops? */
    passable: z.boolean().optional(),
    /** Combat: do troops target it / does it count toward destruction? */
    targetable: z.boolean().optional(),
    /** Default hit points for buildings of this category. */
    hitpoints: z.number().positive().optional(),
    /** Open behavioral tags (e.g. "storage") that analysis/metrics key on. */
    roles: z.array(z.string().min(1)).optional(),
  })
  .strict();

const gameManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    tier: z
      .object({
        label: z.string().min(1),
        shortLabel: z.string().min(1).optional(),
        min: z.number().int().nonnegative(),
        max: z.number().int().positive(),
      })
      .strict(),
    /** The category whose building is the base's core/HQ (win condition). */
    coreCategory: z.string().min(1).optional(),
    wall: z
      .object({
        hitpoints: z.number().positive(),
        label: z.string().min(1).optional(),
      })
      .strict(),
    categories: z.array(categoryDescriptorSchema).min(1),
  })
  .strict();

export type GameManifestJson = z.infer<typeof gameManifestSchema>;

export interface CategoryDescriptor {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly passable: boolean;
  readonly targetable: boolean;
  readonly hitpoints?: number;
  readonly roles: ReadonlyArray<string>;
}

export interface GameDefinition {
  readonly id: string;
  readonly name: string;
  readonly tier: {
    readonly label: string;
    readonly shortLabel?: string;
    readonly min: number;
    readonly max: number;
  };
  readonly coreCategory?: string;
  readonly wall: { readonly hitpoints: number; readonly label?: string };
  readonly categories: ReadonlyMap<string, CategoryDescriptor>;
}

export function parseGameDefinition(
  json: unknown,
  source = "game.json",
): Result<GameDefinition, ParseError> {
  const parsed = gameManifestSchema.safeParse(json);
  if (!parsed.success) return err(flattenZodError(source, parsed.error));
  const m = parsed.data;

  const categories = new Map<string, CategoryDescriptor>();
  for (let i = 0; i < m.categories.length; i++) {
    const c = m.categories[i]!;
    if (categories.has(c.id)) {
      return err({ source, issues: [`duplicate category "${c.id}"`] });
    }
    categories.set(c.id, {
      id: c.id,
      label: c.label,
      order: c.order ?? i,
      passable: c.passable ?? false,
      targetable: c.targetable ?? true,
      ...(c.hitpoints !== undefined ? { hitpoints: c.hitpoints } : {}),
      roles: c.roles ?? [],
    });
  }

  if (m.coreCategory !== undefined && !categories.has(m.coreCategory)) {
    return err({ source, issues: [`coreCategory "${m.coreCategory}" is not a declared category`] });
  }

  const tier = {
    label: m.tier.label,
    min: m.tier.min,
    max: m.tier.max,
    ...(m.tier.shortLabel !== undefined ? { shortLabel: m.tier.shortLabel } : {}),
  };
  const wall = {
    hitpoints: m.wall.hitpoints,
    ...(m.wall.label !== undefined ? { label: m.wall.label } : {}),
  };

  return ok({
    id: m.id,
    name: m.name,
    tier,
    ...(m.coreCategory !== undefined ? { coreCategory: m.coreCategory } : {}),
    wall,
    categories,
  });
}

/**
 * Project a parsed {@link GameDefinition} onto the engine's {@link GameRules}
 * port that simulation/analyzer/ai consume. They depend only on the port, never
 * on how the game was loaded.
 */
export function gameRulesFrom(game: GameDefinition): GameRules {
  const cat = (category: string): CategoryDescriptor | undefined => game.categories.get(category);
  return {
    tierLabel: game.tier.label,
    coreCategory: game.coreCategory,
    wallHitpoints: game.wall.hitpoints,
    categoryHitpoints: (c) => cat(c)?.hitpoints,
    isPassable: (c) => cat(c)?.passable ?? false,
    isTargetable: (c) => cat(c)?.targetable ?? true,
    hasRole: (c, role) => cat(c)?.roles.includes(role) ?? false,
  };
}
