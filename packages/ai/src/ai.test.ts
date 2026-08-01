import { InMemoryBuildingCatalog, VillageEditor, type BuildingDefinition } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { RecommendationEngine, recommendImprovements } from "./engine.js";
import type { Advisor } from "./types.js";

const DEFS: BuildingDefinition[] = [
  {
    id: "town_hall",
    name: "Town Hall",
    category: "townhall",
    width: 4,
    height: 4,
    minTier: 1,
    hitpoints: 1500,
  },
  {
    id: "cannon",
    name: "Cannon",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 1,
    attackRange: 6,
    damageType: "single",
    targets: ["ground"],
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
    hitpoints: 800,
  },
];

const catalog = () => new InMemoryBuildingCatalog(DEFS);
const editor = (size = 20) => VillageEditor.forGridSize(size, catalog(), 1);

describe("placement advisor", () => {
  it("suggests a validated Town Hall move that raises the defense score", () => {
    const ed = editor(20);
    ed.addBuilding("town_hall", { x: 0, y: 0 }); // corner — badly exposed
    const report = recommendImprovements(ed.village, catalog(), { simulate: false });

    const thRec = report.recommendations.find((r) => r.category === "core");
    expect(thRec).toBeDefined();
    expect(thRec!.action?.type).toBe("move");
    expect(thRec!.projectedScore).toBeGreaterThan(report.defenseScore.overall);
  });
});

describe("weak-points advisor", () => {
  it("flags a missing air defense as a high-priority coverage recommendation", () => {
    const ed = editor(20);
    ed.addBuilding("town_hall", { x: 8, y: 8 });
    ed.addBuilding("cannon", { x: 4, y: 8 }); // ground only, no air defense
    const report = recommendImprovements(ed.village, catalog(), { simulate: false });

    const airRec = report.recommendations.find(
      (r) => r.category === "coverage" && /air/i.test(`${r.title} ${r.detail}`),
    );
    expect(airRec).toBeDefined();
    expect(airRec!.priority).toBe("high");
  });
});

describe("recommendation ranking", () => {
  it("orders recommendations high → medium → low", () => {
    const ed = editor(20);
    ed.addBuilding("town_hall", { x: 0, y: 0 });
    ed.addBuilding("gold_storage", { x: 16, y: 16 });
    const report = recommendImprovements(ed.village, catalog(), { simulate: false });

    const rank = { high: 0, medium: 1, low: 2 } as const;
    const values = report.recommendations.map((r) => rank[r.priority]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe("pluggable advisors", () => {
  it("uses only the injected advisors", () => {
    const custom: Advisor = {
      id: "custom",
      advise: () => [
        {
          id: "c1",
          advisorId: "custom",
          category: "general",
          priority: "low",
          title: "Custom",
          detail: "d",
          rationale: "r",
        },
      ],
    };
    const ed = editor(20);
    ed.addBuilding("town_hall", { x: 8, y: 8 });
    const report = new RecommendationEngine([custom]).recommend(ed.village, catalog(), {
      simulate: false,
    });
    expect(report.recommendations.map((r) => r.advisorId)).toEqual(["custom"]);
  });
});

describe("attack probes", () => {
  function base() {
    const ed = editor(24);
    ed.addBuilding("town_hall", { x: 10, y: 10 });
    ed.addBuilding("cannon", { x: 10, y: 4 }); // defended toward the north
    ed.addBuilding("cannon", { x: 6, y: 10 });
    ed.addBuilding("gold_storage", { x: 10, y: 16 });
    return ed;
  }

  it("runs one probe per side, deterministically", () => {
    const ed = base();
    const a = recommendImprovements(ed.village, catalog(), { probeOptions: { maxSeconds: 40 } });
    const b = recommendImprovements(ed.village, catalog(), { probeOptions: { maxSeconds: 40 } });

    expect(a.probes.map((p) => p.direction).sort()).toEqual(["east", "north", "south", "west"]);
    for (const p of a.probes) {
      expect(p.destructionPercent).toBeGreaterThanOrEqual(0);
      expect(p.destructionPercent).toBeLessThanOrEqual(100);
    }
    expect(b.probes).toEqual(a.probes); // deterministic
  });

  it("recommends reinforcing whichever side the probes found weakest", () => {
    const ed = base();
    const report = recommendImprovements(ed.village, catalog(), {
      probeOptions: { maxSeconds: 40 },
    });
    const probeRec = report.recommendations.find((r) => r.advisorId === "simulation-probe");
    if (probeRec) {
      const weakest = [...report.probes].sort(
        (x, y) => y.destructionPercent - x.destructionPercent,
      )[0]!;
      expect(probeRec.title).toContain(weakest.direction);
    }
  });
});
