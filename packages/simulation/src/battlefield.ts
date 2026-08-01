import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type GameRules,
  type Village,
} from "@clash/engine";
import type { GridVec, Rect, Vec2 } from "@clash/shared";
import { invariant } from "@clash/shared";
import { buildingHitpoints, defenseProfile, type DefenseProfile } from "./combat-stats.js";

export interface SimStructure {
  readonly id: string;
  readonly definitionId: string;
  readonly name: string;
  readonly category: string;
  readonly bounds: Rect;
  readonly center: Vec2;
  readonly cells: ReadonlyArray<GridVec>;
  readonly maxHp: number;
  hp: number;
  destroyed: boolean;
  readonly defense: DefenseProfile | undefined;
}

export interface SimWallState {
  readonly id: string;
  readonly position: GridVec;
  readonly maxHp: number;
  hp: number;
  destroyed: boolean;
}

/**
 * Mutable combat state derived from a `Village`. Owns building/wall hit points
 * and the occupancy arrays the pathfinder reads. What blocks movement and what
 * counts as a target are decided by the game's category flags (`passable` /
 * `targetable`) rather than a hardcoded category, so e.g. traps (passable,
 * non-targetable) are ignored in any game that declares them that way. All
 * state updates in place as things are destroyed so pathfinding stays
 * consistent through the battle.
 */
export class Battlefield {
  readonly width: number;
  readonly height: number;
  readonly structures = new Map<string, SimStructure>();
  readonly walls = new Map<string, SimWallState>();
  coreId: string | undefined;

  readonly #wallHp: Float64Array;
  readonly #wallIdAt = new Map<number, string>();
  readonly #blocked: Uint8Array;
  #structuresAlive = 0;

  constructor(village: Village, catalog: BuildingCatalog, rules: GameRules = DEFAULT_GAME_RULES) {
    this.width = village.grid.width;
    this.height = village.grid.height;
    const size = this.width * this.height;
    this.#wallHp = new Float64Array(size);
    this.#blocked = new Uint8Array(size);

    for (const instance of village.listBuildings()) {
      const def = catalog.get(instance.definitionId);
      invariant(def, `Simulation: unknown definition "${instance.definitionId}"`);
      const footprint = village.footprintOf(instance);
      const bounds = footprint.bounds;

      // Non-passable buildings are obstacles (block ground movement).
      if (!rules.isPassable(def.category)) {
        for (const cell of footprint.cells) this.#blocked[this.idx(cell.x, cell.y)] = 1;
      }

      // Only targetable buildings are structures (attacked / counted).
      if (!rules.isTargetable(def.category)) continue;

      const maxHp = buildingHitpoints(def, rules);
      this.structures.set(instance.id, {
        id: instance.id,
        definitionId: instance.definitionId,
        name: def.name,
        category: def.category,
        bounds,
        center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        cells: footprint.cells,
        maxHp,
        hp: maxHp,
        destroyed: false,
        defense: defenseProfile(def),
      });
      if (def.category === rules.coreCategory) this.coreId = instance.id;
      this.#structuresAlive++;
    }

    for (const wall of village.listWalls()) {
      this.walls.set(wall.id, {
        id: wall.id,
        position: wall.position,
        maxHp: rules.wallHitpoints,
        hp: rules.wallHitpoints,
        destroyed: false,
      });
      const i = this.idx(wall.position.x, wall.position.y);
      this.#wallHp[i] = rules.wallHitpoints;
      this.#wallIdAt.set(i, wall.id);
    }
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  get structuresAlive(): number {
    return this.#structuresAlive;
  }

  get structuresTotal(): number {
    return this.structures.size;
  }

  aliveStructures(): SimStructure[] {
    return [...this.structures.values()].filter((s) => !s.destroyed);
  }

  wallHpAt(x: number, y: number): number {
    return this.#wallHp[this.idx(x, y)] ?? 0;
  }

  isBlocked(x: number, y: number): boolean {
    return this.#blocked[this.idx(x, y)] === 1;
  }

  /** Apply damage to a structure. Returns true on the tick it is destroyed. */
  damageStructure(id: string, amount: number): boolean {
    const s = this.structures.get(id);
    if (!s || s.destroyed) return false;
    s.hp -= amount;
    if (s.hp <= 0) {
      s.hp = 0;
      s.destroyed = true;
      this.#structuresAlive--;
      return true;
    }
    return false;
  }

  /** Apply damage to the wall on a tile. Returns its id and whether it broke. */
  damageWallAt(
    x: number,
    y: number,
    amount: number,
  ): { wallId: string | undefined; broken: boolean } {
    const i = this.idx(x, y);
    const hp = this.#wallHp[i] ?? 0;
    if (hp <= 0) return { wallId: undefined, broken: false };
    const wallId = this.#wallIdAt.get(i);
    const next = hp - amount;
    if (next <= 0) {
      this.#wallHp[i] = 0;
      const wall = wallId ? this.walls.get(wallId) : undefined;
      if (wall) {
        wall.hp = 0;
        wall.destroyed = true;
      }
      return { wallId, broken: true };
    }
    this.#wallHp[i] = next;
    const wall = wallId ? this.walls.get(wallId) : undefined;
    if (wall) wall.hp = next;
    return { wallId, broken: false };
  }

  /** Cost function for ground pathfinding: buildings block, walls cost to break. */
  groundEnterCost(ignoresWalls: boolean): (tile: GridVec) => number {
    return ({ x, y }) => {
      const i = this.idx(x, y);
      if (this.#blocked[i]) return Infinity;
      const wallHp = this.#wallHp[i] ?? 0;
      if (wallHp > 0) return ignoresWalls ? 1 : 1 + wallHp / 50;
      return 1;
    };
  }
}
