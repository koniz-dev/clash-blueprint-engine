import type { GridVec, Rect } from "@clash/shared";

/**
 * Tile-occupancy index: maps each occupied tile to the id of its occupant.
 *
 * This is the engine's performance backbone. Placement and overlap checks cost
 * O(footprint) instead of O(objects), so a 1000-building village stays fast.
 * Region queries (for viewport culling / marquee selection) iterate only the
 * queried tiles.
 */
export class TileOccupancyIndex {
  readonly #occupants = new Map<string, string>();

  static key(x: number, y: number): string {
    return `${x},${y}`;
  }

  clear(): void {
    this.#occupants.clear();
  }

  /** Id occupying a tile, or `undefined` if free. */
  occupantAt(pos: GridVec): string | undefined {
    return this.#occupants.get(TileOccupancyIndex.key(pos.x, pos.y));
  }

  /**
   * Are all `cells` free, ignoring any occupied by `ignoreId`? Passing the id
   * being moved lets a building "overlap itself" during a move check.
   */
  areCellsFree(cells: Iterable<GridVec>, ignoreId?: string): boolean {
    for (const cell of cells) {
      const occupant = this.#occupants.get(TileOccupancyIndex.key(cell.x, cell.y));
      if (occupant !== undefined && occupant !== ignoreId) return false;
    }
    return true;
  }

  occupy(id: string, cells: Iterable<GridVec>): void {
    for (const cell of cells) {
      this.#occupants.set(TileOccupancyIndex.key(cell.x, cell.y), id);
    }
  }

  release(cells: Iterable<GridVec>): void {
    for (const cell of cells) {
      this.#occupants.delete(TileOccupancyIndex.key(cell.x, cell.y));
    }
  }

  /** Distinct occupant ids whose tiles fall within `rect` (half-open). */
  queryRect(rect: Rect): Set<string> {
    const found = new Set<string>();
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const occupant = this.#occupants.get(TileOccupancyIndex.key(x, y));
        if (occupant !== undefined) found.add(occupant);
      }
    }
    return found;
  }

  get occupiedTileCount(): number {
    return this.#occupants.size;
  }
}
