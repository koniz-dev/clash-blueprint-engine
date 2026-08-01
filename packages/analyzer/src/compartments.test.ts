import { InMemoryBuildingCatalog, VillageEditor, type BuildingDefinition } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { analyzeCompartments } from "./compartments.js";

const DEFS: BuildingDefinition[] = [
  {
    id: "cannon",
    name: "Cannon",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 1,
    attackRange: 9,
    damageType: "single",
    targets: ["ground"],
  },
];

function editor() {
  return VillageEditor.forGridSize(16, new InMemoryBuildingCatalog(DEFS), 1);
}

/** Add a closed rectangular wall ring on the given inclusive perimeter. */
function ring(ed: VillageEditor, x0: number, y0: number, x1: number, y1: number): void {
  for (let x = x0; x <= x1; x++) {
    ed.addWall({ x, y: y0 });
    ed.addWall({ x, y: y1 });
  }
  for (let y = y0 + 1; y < y1; y++) {
    ed.addWall({ x: x0, y });
    ed.addWall({ x: x1, y });
  }
}

describe("analyzeCompartments", () => {
  it("finds a closed ring as one compartment containing the enclosed building", () => {
    const ed = editor();
    const added = ed.addBuilding("cannon", { x: 5, y: 5 });
    const id = added.ok ? added.value : undefined;
    ring(ed, 4, 4, 8, 8);

    const analysis = analyzeCompartments(ed.village);
    expect(analysis.compartments).toHaveLength(1);
    expect(analysis.compartments[0]?.buildingIds).toContain(id);
    expect(analysis.compartments[0]?.isDeadZone).toBe(false);
    expect(analysis.isolatedWallCount).toBe(0);
  });

  it("detects an empty enclosed area as a dead zone", () => {
    const ed = editor();
    ring(ed, 1, 1, 4, 4); // interior 2x2 = 4 empty tiles

    const analysis = analyzeCompartments(ed.village);
    expect(analysis.compartments).toHaveLength(1);
    expect(analysis.compartments[0]?.isDeadZone).toBe(true);
    expect(analysis.compartments[0]?.buildingIds).toHaveLength(0);
  });

  it("counts scattered walls as isolated and forms no compartments", () => {
    const ed = editor();
    ed.addWall({ x: 1, y: 1 });
    ed.addWall({ x: 5, y: 5 });
    ed.addWall({ x: 9, y: 9 });

    const analysis = analyzeCompartments(ed.village);
    expect(analysis.isolatedWallCount).toBe(3);
    expect(analysis.compartments).toHaveLength(0);
  });
});
