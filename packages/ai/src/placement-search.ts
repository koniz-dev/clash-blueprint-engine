import { Village, type BuildingCatalog } from "@clash/engine";
import { brand, type GridVec, type Vec2 } from "@clash/shared";

export interface PlacementSuggestion {
  readonly position: GridVec;
  readonly score: number;
  readonly baseline: number;
}

/** Tiles on the square ring at Chebyshev radius `r` from (cx, cy). */
function ringTiles(cx: number, cy: number, r: number): GridVec[] {
  if (r === 0) return [{ x: cx, y: cy }];
  const tiles: GridVec[] = [];
  for (let x = cx - r; x <= cx + r; x++) {
    tiles.push({ x, y: cy - r }, { x, y: cy + r });
  }
  for (let y = cy - r + 1; y < cy + r; y++) {
    tiles.push({ x: cx - r, y }, { x: cx + r, y });
  }
  return tiles;
}

/**
 * Search for a placement of `buildingId` near `ideal` that scores better than
 * its current spot, by trying candidates on a *clone* of the village and
 * re-validating each move through the aggregate. The returned position is
 * therefore guaranteed legal (in-bounds, non-overlapping) and measurably
 * better — this is what makes the AI's "move X" suggestions trustworthy rather
 * than hand-wavy.
 */
export function searchBetterPlacement(
  village: Village,
  catalog: BuildingCatalog,
  buildingId: string,
  ideal: Vec2,
  evaluate: (v: Village) => number,
  maxRadius = 4,
): PlacementSuggestion | undefined {
  const id = brand<"Building">(buildingId);
  const instance = village.getBuilding(id);
  if (!instance) return undefined;
  const def = catalog.get(instance.definitionId);
  if (!def) return undefined;

  const snapshot = village.toSnapshot();
  const baseline = evaluate(village);
  const idealX = Math.round(ideal.x - def.width / 2);
  const idealY = Math.round(ideal.y - def.height / 2);

  let best: GridVec | undefined;
  let bestScore = baseline;

  for (let r = 0; r <= maxRadius; r++) {
    for (const tile of ringTiles(idealX, idealY, r)) {
      const clone = Village.fromSnapshot(snapshot, catalog);
      if (!clone.ok) continue;
      const moved = clone.value.transformBuilding(id, tile, instance.rotation);
      if (!moved.ok) continue;
      const score = evaluate(clone.value);
      if (score > bestScore + 1e-6) {
        bestScore = score;
        best = tile;
      }
    }
  }

  if (!best) return undefined;
  return { position: best, score: round(bestScore), baseline: round(baseline) };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
