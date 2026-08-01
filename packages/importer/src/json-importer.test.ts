import {
  InMemoryBuildingCatalog,
  Village,
  type BuildingDefinition,
  type VillageSnapshot,
} from "@clash/engine";
import { CURRENT_SAVE_VERSION, serializeLayout } from "@clash/plugins";
import { describe, expect, it } from "vitest";
import { jsonImporter } from "./json-importer.js";

const snapshot: VillageSnapshot = {
  grid: { width: 44, height: 44 },
  tier: 8,
  buildings: [
    { id: "b1" as never, definitionId: "town_hall", position: { x: 20, y: 20 }, rotation: 0 },
    { id: "b2" as never, definitionId: "cannon", position: { x: 10, y: 10 }, rotation: 90 },
  ],
  walls: [{ id: "w1" as never, position: { x: 0, y: 0 } }],
};

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

describe("jsonImporter", () => {
  it("round-trips a serialized snapshot", () => {
    const result = jsonImporter.import(JSON.stringify(snapshot));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(snapshot);
  });

  it("imports a current-version (wrapped) save file", () => {
    const result = jsonImporter.import(serializeLayout(snapshot));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(snapshot);
  });

  it("migrates a legacy unversioned payload that used `townHall`", () => {
    const legacy = { grid: { width: 44, height: 44 }, townHall: 9, buildings: [], walls: [] };
    const result = jsonImporter.import(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tier).toBe(9);
  });

  it("rejects a save file newer than this app supports", () => {
    const future = JSON.stringify({ formatVersion: CURRENT_SAVE_VERSION + 1, snapshot });
    const result = jsonImporter.import(future);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues.join("\n")).toMatch(/newer|version/i);
  });

  it("rebuilds a valid Village from imported data", () => {
    const result = jsonImporter.import(JSON.stringify(snapshot));
    if (!result.ok) throw new Error("import failed");
    const rebuilt = Village.fromSnapshot(result.value, new InMemoryBuildingCatalog(DEFS));
    expect(rebuilt.ok).toBe(true);
    if (rebuilt.ok) {
      expect(rebuilt.value.buildingCount).toBe(2);
      expect(rebuilt.value.wallCount).toBe(1);
    }
  });

  it("reports malformed JSON as an error", () => {
    const result = jsonImporter.import("{ not json");
    expect(result.ok).toBe(false);
  });

  it("reports structural problems with specific issues", () => {
    const result = jsonImporter.import(JSON.stringify({ grid: { width: 44 }, buildings: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.join("\n")).toMatch(/grid|tier|buildings/);
    }
  });

  it("rejects an invalid rotation value", () => {
    const bad = {
      ...snapshot,
      buildings: [{ id: "b1", definitionId: "cannon", position: { x: 1, y: 1 }, rotation: 45 }],
    };
    const result = jsonImporter.import(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });
});
