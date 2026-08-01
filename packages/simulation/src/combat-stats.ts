import { DEFAULT_GAME_RULES, type BuildingDefinition, type GameRules } from "@clash/engine";

/** Generic hit points when neither the definition nor the game pack specifies. */
const DEFAULT_STRUCTURE_HITPOINTS = 500;

/** Default damage/second for damaging buildings without an explicit value. */
const DEFAULT_DEFENSE_DPS = 30;
const DEFAULT_SPLASH_DPS = 22;

/** Default wall hit points when no game rules are supplied. */
export const WALL_HITPOINTS = DEFAULT_GAME_RULES.wallHitpoints;

export function buildingHitpoints(
  def: BuildingDefinition,
  rules: GameRules = DEFAULT_GAME_RULES,
): number {
  return def.hitpoints ?? rules.categoryHitpoints(def.category) ?? DEFAULT_STRUCTURE_HITPOINTS;
}

/**
 * Damage/second a building deals to troops. A building is a "defense" purely by
 * virtue of having an attack range and a damaging attack — no category literal
 * is consulted, so any game's defensive buildings work.
 */
export function buildingDamagePerSecond(def: BuildingDefinition): number {
  if (def.damagePerSecond !== undefined) return def.damagePerSecond;
  if (!def.attackRange || def.damageType === "none") return 0;
  return def.damageType === "splash" ? DEFAULT_SPLASH_DPS : DEFAULT_DEFENSE_DPS;
}

export interface DefenseProfile {
  readonly range: number;
  readonly dps: number;
  readonly targetsAir: boolean;
  readonly targetsGround: boolean;
}

/** Extract a defense's engagement profile, or `undefined` if it can't fire. */
export function defenseProfile(def: BuildingDefinition): DefenseProfile | undefined {
  if (!def.attackRange) return undefined;
  const dps = buildingDamagePerSecond(def);
  if (dps <= 0) return undefined;
  const targets = def.targets ?? ["ground"];
  return {
    range: def.attackRange,
    dps,
    targetsAir: targets.includes("air"),
    targetsGround: targets.includes("ground"),
  };
}
