import { InMemoryBuildingCatalog, VillageEditor } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { buildScene, wallShape } from "./scene.js";

const catalog = () => new InMemoryBuildingCatalog([]);
const editor = () => VillageEditor.forGridSize(16, catalog(), 1);

function wallAt(scene: ReturnType<typeof buildScene>, x: number, y: number) {
  return scene.walls.find((w) => w.position.x === x && w.position.y === y);
}

describe("wallShape", () => {
  it("classifies by connection count and geometry", () => {
    expect(wallShape({ north: false, east: false, south: false, west: false })).toBe("isolated");
    expect(wallShape({ north: true, east: false, south: false, west: false })).toBe("end");
    expect(wallShape({ north: true, east: false, south: true, west: false })).toBe("straight");
    expect(wallShape({ north: true, east: true, south: false, west: false })).toBe("corner");
    expect(wallShape({ north: true, east: true, south: true, west: false })).toBe("tee");
    expect(wallShape({ north: true, east: true, south: true, west: true })).toBe("cross");
  });
});

describe("buildScene wall auto-connect", () => {
  it("computes neighbour connections and shapes for an L-shaped run", () => {
    const ed = editor();
    // An L: (5,5)-(5,6)-(5,7) vertical, then (6,7)-(7,7) horizontal.
    for (const [x, y] of [
      [5, 5],
      [5, 6],
      [5, 7],
      [6, 7],
      [7, 7],
    ] as const) {
      ed.addWall({ x, y });
    }
    const scene = buildScene(ed.village, catalog());

    expect(wallAt(scene, 5, 5)?.shape).toBe("end"); // top of the vertical
    expect(wallAt(scene, 5, 6)?.shape).toBe("straight");
    expect(wallAt(scene, 5, 7)?.shape).toBe("corner"); // bend
    expect(wallAt(scene, 5, 7)?.connections).toEqual({
      north: true,
      east: true,
      south: false,
      west: false,
    });
    expect(wallAt(scene, 6, 7)?.shape).toBe("straight");
    expect(wallAt(scene, 7, 7)?.shape).toBe("end");
  });

  it("marks a lone wall as isolated", () => {
    const ed = editor();
    ed.addWall({ x: 2, y: 2 });
    const scene = buildScene(ed.village, catalog());
    expect(wallAt(scene, 2, 2)?.shape).toBe("isolated");
  });
});
