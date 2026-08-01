import { InMemoryBuildingCatalog, VillageEditor, type BuildingDefinition } from "@clash/engine";
import { createSequentialIdGenerator } from "@clash/shared";
import { describe, expect, it } from "vitest";
import { categoryColor } from "./renderers/theme.js";
import { buildScene } from "./scene.js";
import { build3DModel } from "./scene3d.js";

const DEFS: BuildingDefinition[] = [
  { id: "town_hall", name: "Town Hall", category: "townhall", width: 4, height: 4, minTier: 1 },
  { id: "cannon", name: "Cannon", category: "defense", width: 3, height: 3, minTier: 1 },
  // A category not in the appearance table, to exercise the fallback.
  { id: "obelisk", name: "Obelisk", category: "mystic", width: 2, height: 2, minTier: 1 },
];

function sampleScene() {
  const catalog = new InMemoryBuildingCatalog(DEFS);
  const editor = VillageEditor.forGridSize(16, catalog, 1, createSequentialIdGenerator("ent"));
  editor.addBuilding("town_hall", { x: 6, y: 6 });
  editor.addBuilding("cannon", { x: 0, y: 0 });
  editor.addBuilding("obelisk", { x: 12, y: 0 });
  // An L-shaped wall run: (2,2)-(2,3)-(2,4) vertical, then (3,4)-(4,4) horizontal.
  for (const [x, y] of [
    [2, 2],
    [2, 3],
    [2, 4],
    [3, 4],
    [4, 4],
  ] as const) {
    editor.addWall({ x, y });
  }
  return buildScene(editor.village, catalog);
}

describe("build3DModel", () => {
  it("maps the ground plane to the grid", () => {
    const model = build3DModel(sampleScene());
    expect(model.ground).toEqual({ width: 16, height: 16 });
  });

  it("sizes and centres each building box on its footprint bounds", () => {
    const model = build3DModel(sampleScene(), { coreCategory: "townhall" });
    const th = model.buildings.find((b) => b.category === "townhall")!;
    // 4×4 footprint at (6,6): centred at (8, 8) on the XZ plane.
    expect(th.size.width).toBe(4);
    expect(th.size.depth).toBe(4);
    expect(th.center.x).toBe(8);
    expect(th.center.z).toBe(8);
    // Rests on the ground: centre Y is half the height.
    expect(th.center.y).toBeCloseTo(th.size.height / 2);
  });

  it("flags the data-designated core and makes it the tallest", () => {
    const model = build3DModel(sampleScene(), { coreCategory: "townhall" });
    const th = model.buildings.find((b) => b.category === "townhall")!;
    const cannon = model.buildings.find((b) => b.category === "defense")!;
    expect(th.isCore).toBe(true);
    expect(cannon.isCore).toBe(false);
    expect(th.size.height).toBeGreaterThan(cannon.size.height);
  });

  it("colors buildings from the shared theme and falls back for unknown categories", () => {
    const model = build3DModel(sampleScene());
    const cannon = model.buildings.find((b) => b.category === "defense")!;
    const obelisk = model.buildings.find((b) => b.category === "mystic")!;
    expect(cannon.color).toBe(categoryColor("defense"));
    expect(obelisk.color).toBe(categoryColor("mystic")); // deterministic fallback
    expect(obelisk.size.height).toBeGreaterThan(0); // fallback height
  });

  it("emits connected wall segments (post + directional connectors)", () => {
    const model = build3DModel(sampleScene());
    // 5 wall tiles: each has a post; the corner tile (2,4) connects north + east.
    expect(model.walls.length).toBeGreaterThan(5);
    // A vertical mid-run tile has connectors along Z (depth 0.5) on both sides.
    const zBars = model.walls.filter((s) => s.size.depth === 0.5);
    const xBars = model.walls.filter((s) => s.size.width === 0.5);
    expect(zBars.length).toBeGreaterThan(0);
    expect(xBars.length).toBeGreaterThan(0);
  });

  it("is deterministic (snapshot)", () => {
    expect(build3DModel(sampleScene(), { coreCategory: "townhall" })).toMatchSnapshot();
  });
});
