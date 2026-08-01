import {
  EventStore,
  InMemoryBuildingCatalog,
  VillageEditor,
  type BuildingDefinition,
} from "@clash/engine";
import { describe, expect, it } from "vitest";
import { simulateAttack } from "./index.js";

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
const editor = () => VillageEditor.forGridSize(16, catalog(), 1);

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

describe("Simulator — destruction", () => {
  it("destroys an undefended building and records a replayable timeline", () => {
    const ed = editor();
    ed.addBuilding("gold_storage", { x: 7, y: 7 });
    const result = simulateAttack(
      ed.village,
      catalog(),
      [{ troopId: "pekka", position: { x: 0, y: 0 } }],
      {
        options: { maxSeconds: 60 },
      },
    );
    expect(result.destructionPercent).toBe(100);
    expect(result.buildingsDestroyed).toBe(1);
    expect(result.destructionOrder).toHaveLength(1);
    expect(result.timeline.length).toBeGreaterThan(1);
    expect(result.events.some((e) => e.type === "buildingDestroyed")).toBe(true);
    expect(result.events.some((e) => e.type === "deploy")).toBe(true);
  });
});

describe("Simulator — defensive fire", () => {
  it("lets a defense kill a weak troop before it does real damage", () => {
    const ed = editor();
    ed.addBuilding("cannon", { x: 7, y: 7 });
    const result = simulateAttack(
      ed.village,
      catalog(),
      [{ troopId: "barbarian", position: { x: 0, y: 7 } }],
      {
        options: { maxSeconds: 60 },
      },
    );
    expect(result.survivingUnits).toBe(0);
    expect(result.buildingsDestroyed).toBe(0);
    expect(result.events.some((e) => e.type === "unitDied")).toBe(true);
  });
});

describe("Simulator — walls", () => {
  it("breaks through a wall ring to reach an enclosed building", () => {
    const ed = editor();
    ed.addBuilding("gold_storage", { x: 7, y: 7 });
    ring(ed, 6, 6, 10, 10);
    const result = simulateAttack(
      ed.village,
      catalog(),
      [{ troopId: "pekka", position: { x: 0, y: 0 } }],
      {
        options: { maxSeconds: 120 },
      },
    );
    expect(result.wallsBroken).toBeGreaterThanOrEqual(1);
    expect(result.buildingsDestroyed).toBe(1);
    expect(result.events.some((e) => e.type === "wallBroken")).toBe(true);
  });

  it("lets air troops ignore walls entirely", () => {
    const ed = editor();
    ed.addBuilding("gold_storage", { x: 7, y: 7 });
    ring(ed, 6, 6, 10, 10);
    const result = simulateAttack(
      ed.village,
      catalog(),
      [{ troopId: "dragon", position: { x: 0, y: 0 } }],
      {
        options: { maxSeconds: 60 },
      },
    );
    expect(result.wallsBroken).toBe(0);
    expect(result.destructionPercent).toBe(100);
  });
});

describe("Simulator — stars & scoring", () => {
  it("awards 3 stars for a full clear including the Town Hall", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 6, y: 6 });
    const result = simulateAttack(
      ed.village,
      catalog(),
      [
        { troopId: "pekka", position: { x: 0, y: 0 } },
        { troopId: "pekka", position: { x: 1, y: 0 } },
        { troopId: "pekka", position: { x: 0, y: 1 } },
      ],
      { options: { maxSeconds: 120 } },
    );
    expect(result.coreDestroyed).toBe(true);
    expect(result.destructionPercent).toBe(100);
    expect(result.stars).toBe(3);
  });
});

describe("Simulator — determinism & events", () => {
  it("produces identical results across runs", () => {
    const build = () => {
      const ed = editor();
      ed.addBuilding("gold_storage", { x: 7, y: 7 });
      ring(ed, 6, 6, 10, 10);
      return ed;
    };
    const deploy = [{ troopId: "pekka" as const, position: { x: 0, y: 0 } }];
    const a = simulateAttack(build().village, catalog(), deploy, { options: { maxSeconds: 120 } });
    const b = simulateAttack(build().village, catalog(), deploy, { options: { maxSeconds: 120 } });
    expect(b.destructionPercent).toBe(a.destructionPercent);
    expect(b.durationSeconds).toBe(a.durationSeconds);
    expect(b.wallsBroken).toBe(a.wallsBroken);
    expect(b.events.length).toBe(a.events.length);
  });

  it("records SimulationStarted/Finished on an event store", () => {
    const ed = editor();
    ed.addBuilding("gold_storage", { x: 7, y: 7 });
    const events = new EventStore();
    simulateAttack(ed.village, catalog(), [{ troopId: "pekka", position: { x: 0, y: 0 } }], {
      eventStore: events,
      options: { maxSeconds: 60 },
    });
    const types = events.all().map((e) => e.event.type);
    expect(types[0]).toBe("SimulationStarted");
    expect(types.at(-1)).toBe("SimulationFinished");
  });
});
