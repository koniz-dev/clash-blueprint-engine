import type { Scene } from "@clash/plugins";
import type { GridVec } from "@clash/shared";

/**
 * Pure geometry helpers for the 2D canvas — framework-free so they can be unit
 * tested without Konva. They read the render `Scene` only; they never touch the
 * engine or mutate anything.
 */

/** Id of the building or wall occupying `tile`, or null. Buildings win ties. */
export function entityIdAt(scene: Scene, tile: GridVec): string | null {
  for (const b of scene.buildings) {
    if (
      tile.x >= b.bounds.x &&
      tile.x < b.bounds.x + b.bounds.width &&
      tile.y >= b.bounds.y &&
      tile.y < b.bounds.y + b.bounds.height
    ) {
      return b.id;
    }
  }
  for (const w of scene.walls) {
    if (w.position.x === tile.x && w.position.y === tile.y) return w.id;
  }
  return null;
}

/**
 * Alignment guides for an in-progress drag: the tile coordinates where the moved
 * selection's edges/centres line up with another (static) entity's.
 */
export function alignmentGuides(
  scene: Scene,
  draggedIds: Set<string>,
  dx: number,
  dy: number,
): { xs: number[]; ys: number[] } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number): void => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  for (const b of scene.buildings) {
    if (draggedIds.has(b.id)) {
      grow(b.bounds.x, b.bounds.y, b.bounds.x + b.bounds.width, b.bounds.y + b.bounds.height);
    }
  }
  for (const w of scene.walls) {
    if (draggedIds.has(w.id)) grow(w.position.x, w.position.y, w.position.x + 1, w.position.y + 1);
  }
  if (minX === Infinity) return { xs: [], ys: [] };

  const left = minX + dx;
  const right = maxX + dx;
  const top = minY + dy;
  const bottom = maxY + dy;
  const candX = new Set<number>();
  const candY = new Set<number>();
  const addRect = (x0: number, y0: number, x1: number, y1: number): void => {
    candX
      .add(x0)
      .add(x1)
      .add((x0 + x1) / 2);
    candY
      .add(y0)
      .add(y1)
      .add((y0 + y1) / 2);
  };
  for (const b of scene.buildings) {
    if (!draggedIds.has(b.id)) {
      addRect(b.bounds.x, b.bounds.y, b.bounds.x + b.bounds.width, b.bounds.y + b.bounds.height);
    }
  }
  for (const w of scene.walls) {
    if (!draggedIds.has(w.id)) {
      addRect(w.position.x, w.position.y, w.position.x + 1, w.position.y + 1);
    }
  }

  const xs = [left, right, (left + right) / 2].filter((v) => candX.has(v));
  const ys = [top, bottom, (top + bottom) / 2].filter((v) => candY.has(v));
  return { xs: [...new Set(xs)], ys: [...new Set(ys)] };
}
