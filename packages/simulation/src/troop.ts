import type { BuildingCategory } from "@clash/engine";

export type MovementType = "ground" | "air";

/**
 * Data-driven troop stats. Distances are in tiles, speed in tiles/second, dps
 * in hit points/second. Like buildings, troops are resolved through a catalog
 * port so a data pack can add or rebalance them without code changes.
 */
export interface TroopDefinition {
  readonly id: string;
  readonly name: string;
  readonly hitpoints: number;
  readonly damagePerSecond: number;
  /** Tiles per second. */
  readonly moveSpeed: number;
  /** Attack reach in tiles (melee ≈ 1). */
  readonly attackRange: number;
  readonly movement: MovementType;
  readonly housingSpace: number;
  /** Preferred target category; falls back to nearest building when absent. */
  readonly favoriteTarget?: BuildingCategory;
  /** Air troops and wall-jumpers (e.g. Hog Rider) are not stopped by walls. */
  readonly ignoresWalls: boolean;
}

export interface TroopCatalog {
  get(troopId: string): TroopDefinition | undefined;
  has(troopId: string): boolean;
  all(): ReadonlyArray<TroopDefinition>;
}

export class InMemoryTroopCatalog implements TroopCatalog {
  readonly #byId: ReadonlyMap<string, TroopDefinition>;
  constructor(troops: Iterable<TroopDefinition>) {
    const map = new Map<string, TroopDefinition>();
    for (const troop of troops) map.set(troop.id, troop);
    this.#byId = map;
  }
  get(id: string): TroopDefinition | undefined {
    return this.#byId.get(id);
  }
  has(id: string): boolean {
    return this.#byId.has(id);
  }
  all(): ReadonlyArray<TroopDefinition> {
    return [...this.#byId.values()];
  }
}

/**
 * Built-in troop roster. Values are illustrative and internally consistent
 * (not exact game constants) — balance is a data concern, correctness of the
 * simulation is what these exercise.
 */
export const DEFAULT_TROOPS: readonly TroopDefinition[] = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitpoints: 45,
    damagePerSecond: 8,
    moveSpeed: 2,
    attackRange: 1,
    movement: "ground",
    housingSpace: 1,
    ignoresWalls: false,
  },
  {
    id: "archer",
    name: "Archer",
    hitpoints: 20,
    damagePerSecond: 7,
    moveSpeed: 2,
    attackRange: 3.5,
    movement: "ground",
    housingSpace: 1,
    ignoresWalls: false,
  },
  {
    id: "giant",
    name: "Giant",
    hitpoints: 300,
    damagePerSecond: 11,
    moveSpeed: 1,
    attackRange: 1,
    movement: "ground",
    housingSpace: 5,
    favoriteTarget: "defense",
    ignoresWalls: false,
  },
  {
    id: "wizard",
    name: "Wizard",
    hitpoints: 75,
    damagePerSecond: 30,
    moveSpeed: 1.6,
    attackRange: 3,
    movement: "ground",
    housingSpace: 4,
    ignoresWalls: false,
  },
  {
    id: "dragon",
    name: "Dragon",
    hitpoints: 800,
    damagePerSecond: 100,
    moveSpeed: 1.5,
    attackRange: 3,
    movement: "air",
    housingSpace: 20,
    ignoresWalls: true,
  },
  {
    id: "pekka",
    name: "P.E.K.K.A",
    hitpoints: 900,
    damagePerSecond: 90,
    moveSpeed: 1,
    attackRange: 1,
    movement: "ground",
    housingSpace: 25,
    ignoresWalls: false,
  },
  {
    id: "hog_rider",
    name: "Hog Rider",
    hitpoints: 200,
    damagePerSecond: 40,
    moveSpeed: 3,
    attackRange: 1,
    movement: "ground",
    housingSpace: 5,
    favoriteTarget: "defense",
    ignoresWalls: true,
  },
];

export function createDefaultTroopCatalog(): InMemoryTroopCatalog {
  return new InMemoryTroopCatalog(DEFAULT_TROOPS);
}
