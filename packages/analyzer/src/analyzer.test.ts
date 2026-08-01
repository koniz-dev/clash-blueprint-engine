import { InMemoryBuildingCatalog, VillageEditor, type BuildingDefinition } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { analyzeLayout } from "./analyzer.js";

const DEFS: BuildingDefinition[] = [
  {
    id: "town_hall",
    name: "Town Hall",
    category: "townhall",
    width: 4,
    height: 4,
    minTier: 1,
  },
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
  {
    id: "archer_tower",
    name: "Archer Tower",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 1,
    attackRange: 10,
    damageType: "single",
    targets: ["ground", "air"],
  },
  {
    id: "air_defense",
    name: "Air Defense",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 1,
    attackRange: 10,
    damageType: "single",
    targets: ["air"],
  },
  {
    id: "gold_storage",
    name: "Gold Storage",
    category: "storage",
    width: 3,
    height: 3,
    minTier: 1,
  },
];

const catalog = () => new InMemoryBuildingCatalog(DEFS);

function metric(score: ReturnType<typeof analyzeLayout>, id: string) {
  return score.metrics.find((m) => m.metricId === id);
}

describe("LayoutAnalyzer", () => {
  it("scores an empty base at the bottom with critical weak points", () => {
    const ed = VillageEditor.forGridSize(44, catalog(), 8);
    const score = analyzeLayout(ed.village, catalog());
    expect(score.overall).toBeLessThan(40);
    expect(score.grade).toBe("F");
    const criticalIds = score.weakPoints
      .filter((w) => w.severity === "critical")
      .map((w) => w.metricId);
    expect(criticalIds).toContain("core-protection");
    expect(criticalIds).toContain("air-coverage");
    expect(criticalIds).toContain("ground-coverage");
  });

  it("scores a centred, defended, walled base substantially higher", () => {
    const ed = VillageEditor.forGridSize(44, catalog(), 8);
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    ed.addBuilding("air_defense", { x: 24, y: 20 });
    ed.addBuilding("archer_tower", { x: 16, y: 20 });
    ed.addBuilding("cannon", { x: 20, y: 16 });
    ed.addBuilding("cannon", { x: 20, y: 25 });
    ed.addBuilding("gold_storage", { x: 24, y: 24 });
    // Wall ring around the Town Hall.
    for (let x = 18; x <= 25; x++) {
      ed.addWall({ x, y: 18 });
      ed.addWall({ x, y: 25 });
    }
    for (let y = 19; y < 25; y++) {
      ed.addWall({ x: 18, y });
      ed.addWall({ x: 25, y });
    }

    const score = analyzeLayout(ed.village, catalog());
    expect(score.overall).toBeGreaterThan(45);
    expect(metric(score, "air-coverage")?.score).toBeGreaterThan(0);
    expect(metric(score, "core-protection")?.score).toBeGreaterThan(50);
  });

  it("rates a centred Town Hall as better protected than an edge one", () => {
    const centred = VillageEditor.forGridSize(44, catalog(), 8);
    centred.addBuilding("town_hall", { x: 20, y: 20 });

    const edge = VillageEditor.forGridSize(44, catalog(), 8);
    edge.addBuilding("town_hall", { x: 0, y: 0 });

    const centredScore = metric(
      analyzeLayout(centred.village, catalog()),
      "core-protection",
    )!.score;
    const edgeScore = metric(analyzeLayout(edge.village, catalog()), "core-protection")!.score;
    expect(centredScore).toBeGreaterThan(edgeScore);
  });

  it("names the exposed side of an edge Town Hall and recommends a fix", () => {
    const ed = VillageEditor.forGridSize(44, catalog(), 8);
    ed.addBuilding("town_hall", { x: 0, y: 0 });
    const score = analyzeLayout(ed.village, catalog());
    const weak = score.weakPoints.find((w) => w.metricId === "core-protection");
    expect(weak?.recommendation).toBeTruthy();
    expect(["north", "west"]).toContain(weak?.area);
  });

  it("produces a weighted overall within 0..100 and a valid grade", () => {
    const ed = VillageEditor.forGridSize(44, catalog(), 8);
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    const score = analyzeLayout(ed.village, catalog());
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(["S", "A", "B", "C", "D", "F"]).toContain(score.grade);
  });
});
