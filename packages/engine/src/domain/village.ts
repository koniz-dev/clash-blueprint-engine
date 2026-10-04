import type { GridVec } from "@clash/shared";
import { err, ok, type Result } from "@clash/shared";
import type { BuildingCatalog } from "./building-definition.js";
import type { BuildingId, BuildingInstance } from "./building.js";
import type { EngineError } from "./errors.js";
import { computeFootprint, type Footprint } from "./footprint.js";
import { Grid } from "./grid.js";
import type { Rotation } from "./rotation.js";
import { TileOccupancyIndex } from "./spatial-index.js";
import type { WallId, WallSegment } from "./wall.js";

/** Serializable snapshot of a village, used for persistence and event replay. */
export interface VillageSnapshot {
  readonly grid: { readonly width: number; readonly height: number };
  /** Progression tier (generic; e.g. Town Hall level in Clash of Clans). */
  readonly tier: number;
  readonly buildings: ReadonlyArray<BuildingInstance>;
  readonly walls: ReadonlyArray<WallSegment>;
}

/**
 * Aggregate root for a village layout. It is the single guardian of spatial
 * integrity: every building/wall it holds is in-bounds and non-overlapping,
 * enforced on each mutation. Mutations return `Result` — expected conflicts
 * (overlap, out of bounds) are values, not exceptions.
 *
 * The aggregate is deliberately behaviour-only about *space*. Game rules
 * (counts, unlock tiers, required buildings) live in the rules/validation
 * packages so this stays reusable across progression tiers and other games.
 */
export class Village {
  readonly grid: Grid;
  #tier: number;
  readonly #catalog: BuildingCatalog;
  readonly #buildings = new Map<BuildingId, BuildingInstance>();
  readonly #walls = new Map<WallId, WallSegment>();
  readonly #index = new TileOccupancyIndex();

  constructor(grid: Grid, catalog: BuildingCatalog, tier = 1) {
    this.grid = grid;
    this.#catalog = catalog;
    this.#tier = tier;
  }

  get tier(): number {
    return this.#tier;
  }

  setTier(tier: number): void {
    this.#tier = tier;
  }

  // --- Read queries -------------------------------------------------------

  getBuilding(id: BuildingId): BuildingInstance | undefined {
    return this.#buildings.get(id);
  }

  getWall(id: WallId): WallSegment | undefined {
    return this.#walls.get(id);
  }

  listBuildings(): ReadonlyArray<BuildingInstance> {
    return [...this.#buildings.values()];
  }

  listWalls(): ReadonlyArray<WallSegment> {
    return [...this.#walls.values()];
  }

  get buildingCount(): number {
    return this.#buildings.size;
  }

  get wallCount(): number {
    return this.#walls.size;
  }

  /** Whether an id is already used by either entity kind. */
  hasEntityId(id: string): boolean {
    return this.#buildings.has(id as BuildingId) || this.#walls.has(id as WallId);
  }

  /** Id of whatever occupies a tile (building or wall), if anything. */
  occupantAt(pos: GridVec): string | undefined {
    return this.#index.occupantAt(pos);
  }

  /** Footprint of a placed building. Throws only on a missing definition (a bug). */
  footprintOf(instance: BuildingInstance): Footprint {
    const def = this.#catalog.get(instance.definitionId);
    if (!def) {
      throw new Error(`Definition "${instance.definitionId}" vanished from catalog`);
    }
    return computeFootprint(def, instance.position, instance.rotation);
  }

  // --- Building mutations -------------------------------------------------

  placeBuilding(instance: BuildingInstance): Result<BuildingInstance, EngineError> {
    if (this.hasEntityId(instance.id)) {
      return err({ kind: "DUPLICATE_ID", id: instance.id });
    }
    const def = this.#catalog.get(instance.definitionId);
    if (!def) {
      return err({ kind: "UNKNOWN_DEFINITION", definitionId: instance.definitionId });
    }
    const footprint = computeFootprint(def, instance.position, instance.rotation);
    if (!this.grid.containsRect(footprint.bounds)) {
      return err({ kind: "OUT_OF_BOUNDS", bounds: footprint.bounds });
    }
    const conflicts = this.#conflictingCells(footprint.cells);
    if (conflicts.length > 0) {
      return err({ kind: "OVERLAP", cells: conflicts });
    }
    this.#buildings.set(instance.id, instance);
    this.#index.occupy(instance.id, footprint.cells);
    return ok(instance);
  }

  /** Move and/or rotate a building. Validates the new footprint atomically. */
  transformBuilding(
    id: BuildingId,
    position: GridVec,
    rotation: Rotation,
  ): Result<BuildingInstance, EngineError> {
    const current = this.#buildings.get(id);
    if (!current) return err({ kind: "NOT_FOUND", id });

    const def = this.#catalog.get(current.definitionId);
    if (!def) {
      return err({ kind: "UNKNOWN_DEFINITION", definitionId: current.definitionId });
    }

    const nextFootprint = computeFootprint(def, position, rotation);
    if (!this.grid.containsRect(nextFootprint.bounds)) {
      return err({ kind: "OUT_OF_BOUNDS", bounds: nextFootprint.bounds });
    }
    const conflicts = this.#conflictingCells(nextFootprint.cells, id);
    if (conflicts.length > 0) {
      return err({ kind: "OVERLAP", cells: conflicts });
    }

    const previousFootprint = computeFootprint(def, current.position, current.rotation);
    this.#index.release(previousFootprint.cells);
    this.#index.occupy(id, nextFootprint.cells);
    const next: BuildingInstance = { ...current, position, rotation };
    this.#buildings.set(id, next);
    return ok(next);
  }

  removeBuilding(id: BuildingId): Result<BuildingInstance, EngineError> {
    const current = this.#buildings.get(id);
    if (!current) return err({ kind: "NOT_FOUND", id });
    const footprint = this.footprintOf(current);
    this.#index.release(footprint.cells);
    this.#buildings.delete(id);
    return ok(current);
  }

  // --- Wall mutations -----------------------------------------------------

  addWall(segment: WallSegment): Result<WallSegment, EngineError> {
    if (this.hasEntityId(segment.id)) {
      return err({ kind: "DUPLICATE_ID", id: segment.id });
    }
    if (!this.grid.containsTile(segment.position)) {
      return err({
        kind: "OUT_OF_BOUNDS",
        bounds: { x: segment.position.x, y: segment.position.y, width: 1, height: 1 },
      });
    }
    const conflicts = this.#conflictingCells([segment.position]);
    if (conflicts.length > 0) {
      return err({ kind: "OVERLAP", cells: conflicts });
    }
    this.#walls.set(segment.id, segment);
    this.#index.occupy(segment.id, [segment.position]);
    return ok(segment);
  }

  /** Move a wall to a new tile, preserving its id. Validated atomically. */
  moveWall(id: WallId, position: GridVec): Result<WallSegment, EngineError> {
    const current = this.#walls.get(id);
    if (!current) return err({ kind: "NOT_FOUND", id });
    if (!this.grid.containsTile(position)) {
      return err({
        kind: "OUT_OF_BOUNDS",
        bounds: { x: position.x, y: position.y, width: 1, height: 1 },
      });
    }
    const conflicts = this.#conflictingCells([position], id);
    if (conflicts.length > 0) {
      return err({ kind: "OVERLAP", cells: conflicts });
    }
    this.#index.release([current.position]);
    this.#index.occupy(id, [position]);
    const next: WallSegment = { ...current, position };
    this.#walls.set(id, next);
    return ok(next);
  }

  /**
   * Atomically transform a mixed set of buildings and walls. Destination
   * occupancy is evaluated as a whole, with every moved entity removed from
   * its old position, so adjacent selections can translate through one
   * another's former cells.
   */
  transformEntities(
    buildingTransforms: readonly {
      readonly id: BuildingId;
      readonly position: GridVec;
      readonly rotation: Rotation;
    }[],
    wallTransforms: readonly { readonly id: WallId; readonly position: GridVec }[],
  ): Result<void, EngineError> {
    const movingIds = new Set<string>();
    for (const { id } of [...buildingTransforms, ...wallTransforms]) {
      if (movingIds.has(id)) return err({ kind: "DUPLICATE_ID", id });
      movingIds.add(id);
    }

    const buildings: Array<{
      current: BuildingInstance;
      next: BuildingInstance;
      currentFootprint: Footprint;
      nextFootprint: Footprint;
    }> = [];
    for (const transform of buildingTransforms) {
      const current = this.#buildings.get(transform.id);
      if (!current) return err({ kind: "NOT_FOUND", id: transform.id });
      const def = this.#catalog.get(current.definitionId);
      if (!def) return err({ kind: "UNKNOWN_DEFINITION", definitionId: current.definitionId });
      const nextFootprint = computeFootprint(def, transform.position, transform.rotation);
      if (!this.grid.containsRect(nextFootprint.bounds)) {
        return err({ kind: "OUT_OF_BOUNDS", bounds: nextFootprint.bounds });
      }
      buildings.push({
        current,
        next: { ...current, position: transform.position, rotation: transform.rotation },
        currentFootprint: computeFootprint(def, current.position, current.rotation),
        nextFootprint,
      });
    }

    const walls: Array<{ current: WallSegment; next: WallSegment }> = [];
    for (const transform of wallTransforms) {
      const current = this.#walls.get(transform.id);
      if (!current) return err({ kind: "NOT_FOUND", id: transform.id });
      if (!this.grid.containsTile(transform.position)) {
        return err({
          kind: "OUT_OF_BOUNDS",
          bounds: { x: transform.position.x, y: transform.position.y, width: 1, height: 1 },
        });
      }
      walls.push({ current, next: { ...current, position: transform.position } });
    }

    const destinationOwners = new Map<string, string>();
    const conflicts: GridVec[] = [];
    const inspect = (id: string, cells: readonly GridVec[]): void => {
      for (const cell of cells) {
        const key = TileOccupancyIndex.key(cell.x, cell.y);
        const destinationOwner = destinationOwners.get(key);
        const currentOwner = this.#index.occupantAt(cell);
        if (
          (destinationOwner !== undefined && destinationOwner !== id) ||
          (currentOwner !== undefined && !movingIds.has(currentOwner))
        ) {
          conflicts.push(cell);
        }
        destinationOwners.set(key, id);
      }
    };
    for (const update of buildings) inspect(update.current.id, update.nextFootprint.cells);
    for (const update of walls) inspect(update.current.id, [update.next.position]);
    if (conflicts.length > 0) return err({ kind: "OVERLAP", cells: conflicts });

    for (const update of buildings) this.#index.release(update.currentFootprint.cells);
    for (const update of walls) this.#index.release([update.current.position]);
    for (const update of buildings) {
      this.#buildings.set(update.next.id, update.next);
      this.#index.occupy(update.next.id, update.nextFootprint.cells);
    }
    for (const update of walls) {
      this.#walls.set(update.next.id, update.next);
      this.#index.occupy(update.next.id, [update.next.position]);
    }
    return ok(undefined);
  }

  removeWall(id: WallId): Result<WallSegment, EngineError> {
    const segment = this.#walls.get(id);
    if (!segment) return err({ kind: "NOT_FOUND", id });
    this.#index.release([segment.position]);
    this.#walls.delete(id);
    return ok(segment);
  }

  // --- Serialization ------------------------------------------------------

  toSnapshot(): VillageSnapshot {
    return {
      grid: this.grid.toJSON(),
      tier: this.#tier,
      buildings: this.listBuildings(),
      walls: this.listWalls(),
    };
  }

  /**
   * Rebuild a village from a snapshot. Placement is re-validated so a
   * corrupt/incompatible save surfaces as an error rather than silent bad state.
   */
  static fromSnapshot(
    snapshot: VillageSnapshot,
    catalog: BuildingCatalog,
  ): Result<Village, EngineError> {
    const village = new Village(new Grid(snapshot.grid), catalog, snapshot.tier);
    for (const building of snapshot.buildings) {
      const placed = village.placeBuilding(building);
      if (!placed.ok) return placed;
    }
    for (const wall of snapshot.walls) {
      const added = village.addWall(wall);
      if (!added.ok) return added;
    }
    return ok(village);
  }

  // --- Internals ----------------------------------------------------------

  #conflictingCells(cells: ReadonlyArray<GridVec>, ignoreId?: string): GridVec[] {
    const conflicts: GridVec[] = [];
    for (const cell of cells) {
      const occupant = this.#index.occupantAt(cell);
      if (occupant !== undefined && occupant !== ignoreId) conflicts.push(cell);
    }
    return conflicts;
  }
}
