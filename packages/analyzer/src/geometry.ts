import type { Grid } from "@clash/engine";
import type { Rect, Vec2 } from "@clash/shared";
import { euclideanDistance } from "@clash/shared";
import type { DefenseUnit, Direction } from "./types.js";

export function rectCenter(rect: Rect): Vec2 {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function gridCenter(grid: Grid): Vec2 {
  return { x: grid.width / 2, y: grid.height / 2 };
}

/**
 * How central a point is: 1 at the exact centre, 0 at a corner. Used to reward
 * burying the Town Hall and storages in the core.
 */
export function centrality(point: Vec2, grid: Grid): number {
  const center = gridCenter(grid);
  const maxDistance = euclideanDistance({ x: 0, y: 0 }, center);
  if (maxDistance === 0) return 1;
  return clamp01(1 - euclideanDistance(point, center) / maxDistance);
}

/** Cardinal direction of `point` relative to `origin` (grid space, y-down). */
export function directionOf(point: Vec2, origin: Vec2): Direction {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "north" : "south";
  return dx < 0 ? "west" : "east";
}

/** Is `target` within any defense's range (optionally restricted to air/ground)? */
export function isCovered(
  target: Vec2,
  defenses: ReadonlyArray<DefenseUnit>,
  filter: (d: DefenseUnit) => boolean,
): boolean {
  for (const defense of defenses) {
    if (filter(defense) && euclideanDistance(defense.center, target) <= defense.range) {
      return true;
    }
  }
  return false;
}

/** Fraction of `targets` covered by a qualifying defense (0–1). */
export function coverageRatio(
  targets: ReadonlyArray<Vec2>,
  defenses: ReadonlyArray<DefenseUnit>,
  filter: (d: DefenseUnit) => boolean,
): number {
  if (targets.length === 0) return 1;
  let covered = 0;
  for (const target of targets) {
    if (isCovered(target, defenses, filter)) covered++;
  }
  return covered / targets.length;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
