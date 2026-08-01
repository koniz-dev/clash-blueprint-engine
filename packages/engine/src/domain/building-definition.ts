/**
 * A building's category. Intentionally an open `string` (not a closed union):
 * the *valid* set is declared by the active game pack and validated in
 * `@clash/rules-engine`, so a new game can introduce new categories with zero
 * engine changes. The engine treats it as an opaque grouping key.
 */
export type BuildingCategory = string;

/**
 * The immutable, data-driven description of a building *type* (a Cannon, an
 * Air Defense…). Instances ({@link ./building.ts}) reference a definition by
 * id. Definitions come from JSON in `data/` — none of this is hardcoded, so
 * adding a building is a data change, not a code change.
 */
export interface BuildingDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: BuildingCategory;
  /** Unrotated footprint width in tiles. */
  readonly width: number;
  /** Unrotated footprint height in tiles. */
  readonly height: number;
  /**
   * Optional explicit occupied cells, relative to the top-left of the
   * bounding box. When omitted the footprint is the full `width × height`
   * rectangle. Enables non-rectangular hitboxes later without a model change.
   */
  readonly hitbox?: ReadonlyArray<readonly [number, number]>;
  /** Minimum progression tier at which this building becomes available. */
  readonly minTier: number;
  // --- Optional combat metadata, consumed by simulation/analyzer packages ---
  readonly attackRange?: number;
  readonly damageType?: "single" | "splash" | "none";
  readonly targets?: ReadonlyArray<"ground" | "air">;
  /** Structure hit points. Simulation falls back to a category default if unset. */
  readonly hitpoints?: number;
  /** Damage per second this building deals to troops (defenses). */
  readonly damagePerSecond?: number;
}

/**
 * Port for resolving definitions. The domain depends on this interface, never
 * on a concrete data source, so the same aggregate works with a JSON pack, an
 * in-memory test fixture, or a remote catalog.
 */
export interface BuildingCatalog {
  get(definitionId: string): BuildingDefinition | undefined;
  has(definitionId: string): boolean;
  all(): ReadonlyArray<BuildingDefinition>;
}

export class InMemoryBuildingCatalog implements BuildingCatalog {
  readonly #byId: ReadonlyMap<string, BuildingDefinition>;

  constructor(definitions: Iterable<BuildingDefinition>) {
    const map = new Map<string, BuildingDefinition>();
    for (const def of definitions) map.set(def.id, def);
    this.#byId = map;
  }

  get(definitionId: string): BuildingDefinition | undefined {
    return this.#byId.get(definitionId);
  }

  has(definitionId: string): boolean {
    return this.#byId.has(definitionId);
  }

  all(): ReadonlyArray<BuildingDefinition> {
    return [...this.#byId.values()];
  }
}
