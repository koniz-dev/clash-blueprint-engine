import { describe, expect, it } from "vitest";
import type { Scene } from "@clash/plugins";
import { alignmentGuides, entityIdAt } from "./canvas-geometry";

const scene = {
  grid: { width: 20, height: 20 },
  tier: 1,
  tierLabel: "TH",
  buildings: [
    { id: "b1", name: "A", category: "defense", bounds: { x: 2, y: 2, width: 4, height: 4 } },
    { id: "b2", name: "B", category: "defense", bounds: { x: 10, y: 2, width: 4, height: 4 } },
  ],
  walls: [{ id: "w1", position: { x: 8, y: 8 } }],
} as unknown as Scene;

describe("entityIdAt", () => {
  it("finds a building by footprint", () => {
    expect(entityIdAt(scene, { x: 3, y: 3 })).toBe("b1");
    expect(entityIdAt(scene, { x: 5, y: 5 })).toBe("b1"); // last covered tile
  });
  it("finds a wall by its tile", () => {
    expect(entityIdAt(scene, { x: 8, y: 8 })).toBe("w1");
  });
  it("returns null on empty tiles", () => {
    expect(entityIdAt(scene, { x: 0, y: 0 })).toBeNull();
    expect(entityIdAt(scene, { x: 6, y: 2 })).toBeNull(); // just past b1's right edge
  });
});

describe("alignmentGuides", () => {
  it("reports a vertical guide when a dragged building's edge lines up", () => {
    // Drag b1 right by 8 → its left edge (2→10) matches b2's left edge (10).
    const { xs } = alignmentGuides(scene, new Set(["b1"]), 8, 0);
    expect(xs).toContain(10);
  });

  it("reports a horizontal guide when top edges line up", () => {
    // b1 and b2 share top edge y=2; dragging b1 by dy=0 keeps them aligned.
    const { ys } = alignmentGuides(scene, new Set(["b1"]), 0, 0);
    expect(ys).toContain(2);
  });

  it("returns no guides when nothing lines up", () => {
    const { xs, ys } = alignmentGuides(scene, new Set(["b1"]), 1, 1);
    expect(xs).toEqual([]);
    expect(ys).toEqual([]);
  });

  it("is empty when the dragged set is empty", () => {
    expect(alignmentGuides(scene, new Set(), 3, 3)).toEqual({ xs: [], ys: [] });
  });
});
