import type { GridVec, Rect } from "@clash/shared";
import { invariant } from "@clash/shared";

/**
 * The playfield. A value object describing tile-space extent, decoupled from
 * any particular Town Hall level so a rules pack can pick 44×44, 48×48 or a
 * future size without touching engine code.
 */
export interface GridConfig {
  readonly width: number;
  readonly height: number;
}

export class Grid {
  readonly width: number;
  readonly height: number;

  constructor(config: GridConfig) {
    invariant(
      Number.isInteger(config.width) && config.width > 0,
      "Grid width must be a positive integer",
    );
    invariant(
      Number.isInteger(config.height) && config.height > 0,
      "Grid height must be a positive integer",
    );
    this.width = config.width;
    this.height = config.height;
  }

  static square(size: number): Grid {
    return new Grid({ width: size, height: size });
  }

  get tileCount(): number {
    return this.width * this.height;
  }

  containsTile(pos: GridVec): boolean {
    return pos.x >= 0 && pos.y >= 0 && pos.x < this.width && pos.y < this.height;
  }

  /** Is a whole footprint rectangle inside the grid? */
  containsRect(rect: Rect): boolean {
    return (
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= this.width &&
      rect.y + rect.height <= this.height
    );
  }

  toJSON(): GridConfig {
    return { width: this.width, height: this.height };
  }
}
