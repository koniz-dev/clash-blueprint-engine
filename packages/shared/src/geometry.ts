/** Integer grid coordinate (tile space). */
export interface GridVec {
  readonly x: number;
  readonly y: number;
}

/** Continuous coordinate (world/pixel space) used by renderers and simulation. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned bounding box in tile space. `max` is exclusive. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function gridVec(x: number, y: number): GridVec {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, factor: number): Vec2 {
  return { x: a.x * factor, y: a.y * factor };
}

export function manhattanDistance(a: GridVec, b: GridVec): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclideanDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function rectContains(rect: Rect, point: GridVec): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

/** Do two half-open tile rectangles overlap on any cell? */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
