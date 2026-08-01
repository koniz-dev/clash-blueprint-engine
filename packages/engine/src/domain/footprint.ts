import type { GridVec, Rect } from "@clash/shared";
import type { BuildingDefinition } from "./building-definition.js";
import { swapsAxes, type Rotation } from "./rotation.js";

/** The set of tiles a placed object occupies, plus its bounding rectangle. */
export interface Footprint {
  readonly cells: ReadonlyArray<GridVec>;
  readonly bounds: Rect;
}

/** Base occupied cells relative to the unrotated bounding box's top-left. */
function baseCells(def: BuildingDefinition): ReadonlyArray<readonly [number, number]> {
  if (def.hitbox && def.hitbox.length > 0) return def.hitbox;
  const cells: Array<readonly [number, number]> = [];
  for (let y = 0; y < def.height; y++) {
    for (let x = 0; x < def.width; x++) {
      cells.push([x, y]);
    }
  }
  return cells;
}

/**
 * Rotate a relative cell around the bounding box by a multiple of 90°.
 * Grid space is y-down; rotations are clockwise. Results stay non-negative and
 * within the (possibly axis-swapped) bounding box.
 */
function rotateCell(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: Rotation,
): readonly [number, number] {
  switch (rotation) {
    case 0:
      return [x, y];
    case 90:
      return [height - 1 - y, x];
    case 180:
      return [width - 1 - x, height - 1 - y];
    case 270:
      return [y, width - 1 - x];
  }
}

/** Compute the absolute footprint of a definition placed at `position`. */
export function computeFootprint(
  def: BuildingDefinition,
  position: GridVec,
  rotation: Rotation,
): Footprint {
  const cells = baseCells(def).map(([x, y]) => {
    const [rx, ry] = rotateCell(x, y, def.width, def.height, rotation);
    return { x: position.x + rx, y: position.y + ry };
  });

  const swapped = swapsAxes(rotation);
  const bounds: Rect = {
    x: position.x,
    y: position.y,
    width: swapped ? def.height : def.width,
    height: swapped ? def.width : def.height,
  };

  return { cells, bounds };
}
