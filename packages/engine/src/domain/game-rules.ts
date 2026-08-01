/**
 * The behavioral projection of a game that downstream layers (simulation,
 * analyzer, AI) consume. It is a small *port* interface deliberately living in
 * the core so those packages depend only on the engine, never on how a game is
 * loaded. `@clash/rules-engine` builds one from a `game.json` manifest; the
 * engine core itself never reads it (the `Village` aggregate stays game-neutral).
 */
export interface GameRules {
  /** Label for the progression axis, e.g. "Town Hall" or "Keep Level". */
  readonly tierLabel: string;
  /** Category whose building is the base's core/HQ, if the game has one. */
  readonly coreCategory: string | undefined;
  readonly wallHitpoints: number;
  /** Default hit points for a category, or `undefined` to fall back generically. */
  categoryHitpoints(category: string): number | undefined;
  /** Does a building of this category let ground troops pass through? */
  isPassable(category: string): boolean;
  /** Do troops target it / does it count toward destruction? */
  isTargetable(category: string): boolean;
  /** Does this category carry a behavioral role (e.g. "storage")? */
  hasRole(category: string, role: string): boolean;
}

/**
 * Fallback rules matching the first game's (Clash of Clans) conventions. Used
 * whenever a caller does not supply an explicit {@link GameRules}, so existing
 * call sites keep working while the behavior stays data-overridable.
 */
const DEFAULT_CATEGORY_HP: Record<string, number> = {
  townhall: 1500,
  defense: 400,
  storage: 800,
  resource: 400,
  army: 350,
  trap: 1,
};

export const DEFAULT_GAME_RULES: GameRules = {
  tierLabel: "Tier",
  coreCategory: "townhall",
  wallHitpoints: 300,
  categoryHitpoints: (category) => DEFAULT_CATEGORY_HP[category],
  isPassable: (category) => category === "trap",
  isTargetable: (category) => category !== "trap",
  hasRole: (category, role) => role === "storage" && category === "storage",
};
