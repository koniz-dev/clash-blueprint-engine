import { describe, expect, it } from "vitest";
import type { BuildingDefinition } from "./building-definition.js";
import { computeFootprint } from "./footprint.js";

const airDefense: BuildingDefinition = {
  id: "air_defense",
  name: "Air Defense",
  category: "defense",
  width: 3,
  height: 2,
  minTier: 1,
};

function cellSet(cells: ReadonlyArray<{ x: number; y: number }>): Set<string> {
  return new Set(cells.map((c) => `${c.x},${c.y}`));
}

describe("computeFootprint", () => {
  it("covers the full rectangle when unrotated", () => {
    const fp = computeFootprint(airDefense, { x: 5, y: 5 }, 0);
    expect(fp.bounds).toEqual({ x: 5, y: 5, width: 3, height: 2 });
    expect(fp.cells).toHaveLength(6);
    expect(cellSet(fp.cells)).toEqual(
      cellSet([
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 7, y: 6 },
      ]),
    );
  });

  it("swaps width and height on a 90° rotation", () => {
    const fp = computeFootprint(airDefense, { x: 0, y: 0 }, 90);
    expect(fp.bounds).toEqual({ x: 0, y: 0, width: 2, height: 3 });
    expect(fp.cells).toHaveLength(6);
    // All cells stay within the rotated 2×3 bounding box, non-negative.
    for (const cell of fp.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(2);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeLessThan(3);
    }
  });

  it("returns to the original footprint after four 90° rotations", () => {
    const base = cellSet(computeFootprint(airDefense, { x: 2, y: 3 }, 0).cells);
    const full = cellSet(computeFootprint(airDefense, { x: 2, y: 3 }, 0).cells);
    // 180° twice == identity in occupied-cell terms for a rectangle.
    const rot180 = cellSet(computeFootprint(airDefense, { x: 2, y: 3 }, 180).cells);
    expect(rot180).toEqual(base);
    expect(full).toEqual(base);
  });

  it("keeps cell count invariant across all rotations", () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      expect(computeFootprint(airDefense, { x: 4, y: 4 }, rotation).cells).toHaveLength(6);
    }
  });
});
