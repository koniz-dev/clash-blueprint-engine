import { InMemoryBuildingCatalog, VillageEditor, type BuildingDefinition } from "@clash/engine";
import { createSequentialIdGenerator } from "@clash/shared";
import { describe, expect, it } from "vitest";
import { buildScene } from "../scene.js";
import { asciiRenderer } from "./ascii.js";
import { mermaidRenderer } from "./mermaid.js";
import { svgRenderer } from "./svg.js";

const DEFS: BuildingDefinition[] = [
  {
    id: "town_hall",
    name: "Town Hall",
    category: "townhall",
    width: 4,
    height: 4,
    minTier: 1,
  },
  { id: "cannon", name: "Cannon", category: "defense", width: 3, height: 3, minTier: 1 },
];

/** A small, fully deterministic village for stable render snapshots. */
function sampleScene() {
  const catalog = new InMemoryBuildingCatalog(DEFS);
  const editor = VillageEditor.forGridSize(12, catalog, 1, createSequentialIdGenerator("ent"));
  editor.addBuilding("town_hall", { x: 4, y: 4 });
  editor.addBuilding("cannon", { x: 0, y: 0 });
  editor.addWall({ x: 2, y: 11 });
  editor.addWall({ x: 3, y: 11 });
  return buildScene(editor.village, catalog);
}

describe("buildScene", () => {
  it("produces a deterministic, sorted render model", () => {
    const scene = sampleScene();
    expect(scene.grid).toEqual({ width: 12, height: 12 });
    expect(scene.buildings).toHaveLength(2);
    expect(scene.walls).toHaveLength(2);
    expect(scene.buildings.map((b) => b.id)).toEqual([...scene.buildings.map((b) => b.id)].sort());
    expect(scene.buildings.map((b) => b.name)).toContain("Town Hall");
  });
});

describe("asciiRenderer", () => {
  it("matches the blueprint snapshot", () => {
    expect(asciiRenderer.render(sampleScene())).toMatchSnapshot();
  });

  it("has one body row per grid line plus header and legend", () => {
    const out = asciiRenderer.render(sampleScene());
    const lines = out.trimEnd().split("\n");
    // 1 header + 12 rows + 1 legend
    expect(lines).toHaveLength(14);
    expect(lines[0]).toContain("12x12");
    expect(out).toContain("H");
    expect(out).toContain("D");
    expect(out).toContain("#");
  });
});

describe("svgRenderer", () => {
  it("matches the SVG snapshot", () => {
    expect(svgRenderer.render(sampleScene())).toMatchSnapshot();
  });

  it("sizes the viewport to the grid and colors buildings by category", () => {
    const out = svgRenderer.render(sampleScene());
    expect(out).toContain('width="288" height="288"'); // 12 * 24
    expect(out).toContain("#c62828"); // defense color
    expect(out).toContain("#2e7d32"); // townhall color
  });
});

describe("mermaidRenderer", () => {
  it("matches the Mermaid snapshot", () => {
    expect(mermaidRenderer.render(sampleScene())).toMatchSnapshot();
  });

  it("groups buildings into category subgraphs", () => {
    const out = mermaidRenderer.render(sampleScene());
    expect(out).toContain("flowchart TB");
    expect(out).toContain('subgraph townhall["Town Hall"]');
    expect(out).toContain('subgraph defense["Defense"]');
    expect(out).toContain("%% walls: 2");
  });
});
