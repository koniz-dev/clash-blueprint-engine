/** Buildings and walls rotate in 90° steps only, matching the tile grid. */
export type Rotation = 0 | 90 | 180 | 270;

export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

export function isRotation(value: number): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

export function normalizeRotation(degrees: number): Rotation {
  const wrapped = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
  return wrapped as Rotation;
}

export function rotateClockwise(rotation: Rotation): Rotation {
  return normalizeRotation(rotation + 90);
}

export function rotateCounterClockwise(rotation: Rotation): Rotation {
  return normalizeRotation(rotation - 90);
}

/** A 90°/270° rotation swaps a footprint's width and height. */
export function swapsAxes(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}
