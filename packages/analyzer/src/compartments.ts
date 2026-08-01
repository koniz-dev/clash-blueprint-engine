import type { Village } from "@clash/engine";
import type { GridVec } from "@clash/shared";

/** A connected region of tiles sealed off from the map border by walls. */
export interface Compartment {
  readonly tiles: ReadonlyArray<GridVec>;
  readonly buildingIds: ReadonlyArray<string>;
  readonly emptyTileCount: number;
  /** Enclosed but empty — walls spent protecting nothing. */
  readonly isDeadZone: boolean;
}

export interface CompartmentAnalysis {
  readonly compartments: ReadonlyArray<Compartment>;
  readonly enclosedTileCount: number;
  readonly wallCount: number;
  /** Walls with no orthogonally-adjacent wall — they seal nothing. */
  readonly isolatedWallCount: number;
}

const DEAD_ZONE_MIN_TILES = 4;

/**
 * Detect closed compartments by flood-filling the map border across every
 * non-wall tile. Tiles the fill cannot reach are *enclosed*; their connected
 * components are the compartments. This is the geometric basis for compartment
 * quality, dead-zone detection and "defenses behind walls" scoring.
 *
 * Walls are the only barrier (buildings are not), matching how walls define
 * regions in Clash of Clans. Cost is O(grid tiles).
 */
export function analyzeCompartments(village: Village): CompartmentAnalysis {
  const w = village.grid.width;
  const h = village.grid.height;
  const idx = (x: number, y: number): number => y * w + x;

  const isWall = new Uint8Array(w * h);
  for (const wall of village.listWalls()) {
    isWall[idx(wall.position.x, wall.position.y)] = 1;
  }

  // Tiles occupied by a building, and the building whose centre sits on a tile.
  const buildingAt = new Map<number, string>();
  for (const building of village.listBuildings()) {
    const footprint = village.footprintOf(building);
    const center = footprint.bounds;
    const cx = Math.floor(center.x + center.width / 2);
    const cy = Math.floor(center.y + center.height / 2);
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) buildingAt.set(idx(cx, cy), building.id);
  }

  // Flood fill reachable-from-border across non-wall tiles (4-connectivity).
  const reachable = new Uint8Array(w * h);
  const stack: number[] = [];
  const pushIfOpen = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = idx(x, y);
    if (isWall[i] || reachable[i]) return;
    reachable[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    pushIfOpen(x, 0);
    pushIfOpen(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfOpen(0, y);
    pushIfOpen(w - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    pushIfOpen(x + 1, y);
    pushIfOpen(x - 1, y);
    pushIfOpen(x, y + 1);
    pushIfOpen(x, y - 1);
  }

  // Connected components of enclosed (non-wall, non-reachable) tiles.
  const visited = new Uint8Array(w * h);
  const compartments: Compartment[] = [];
  let enclosedTileCount = 0;

  for (let start = 0; start < w * h; start++) {
    if (isWall[start] || reachable[start] || visited[start]) continue;
    const tiles: GridVec[] = [];
    const buildingIds = new Set<string>();
    let emptyTileCount = 0;
    const componentStack = [start];
    visited[start] = 1;
    while (componentStack.length > 0) {
      const i = componentStack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      tiles.push({ x, y });
      enclosedTileCount++;
      const occupant = buildingAt.get(i);
      if (occupant) buildingIds.add(occupant);
      if (!village.occupantAt({ x, y })) emptyTileCount++;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = idx(nx, ny);
        if (isWall[ni] || reachable[ni] || visited[ni]) continue;
        visited[ni] = 1;
        componentStack.push(ni);
      }
    }
    compartments.push({
      tiles,
      buildingIds: [...buildingIds],
      emptyTileCount,
      isDeadZone: buildingIds.size === 0 && tiles.length >= DEAD_ZONE_MIN_TILES,
    });
  }

  return {
    compartments,
    enclosedTileCount,
    wallCount: village.wallCount,
    isolatedWallCount: countIsolatedWalls(village, isWall, w, h),
  };
}

function countIsolatedWalls(village: Village, isWall: Uint8Array, w: number, h: number): number {
  const idx = (x: number, y: number): number => y * w + x;
  let isolated = 0;
  for (const wall of village.listWalls()) {
    const { x, y } = wall.position;
    const hasNeighbour =
      (x + 1 < w && isWall[idx(x + 1, y)] === 1) ||
      (x - 1 >= 0 && isWall[idx(x - 1, y)] === 1) ||
      (y + 1 < h && isWall[idx(x, y + 1)] === 1) ||
      (y - 1 >= 0 && isWall[idx(x, y - 1)] === 1);
    if (!hasNeighbour) isolated++;
  }
  return isolated;
}
