import { brand } from "@clash/shared";
import { describe, expect, it } from "vitest";
import { createTestCatalog } from "../testing/fixtures.js";
import { Grid } from "./grid.js";
import { Village } from "./village.js";

function makeVillage(): Village {
  return new Village(Grid.square(44), createTestCatalog(), 8);
}

const building = (id: string, definitionId: string, x: number, y: number) => ({
  id: brand<"Building">(id),
  definitionId,
  position: { x, y },
  rotation: 0 as const,
});

describe("Village placement", () => {
  it("places a building and occupies its tiles", () => {
    const village = makeVillage();
    const result = village.placeBuilding(building("b1", "cannon", 10, 10));
    expect(result.ok).toBe(true);
    expect(village.buildingCount).toBe(1);
    expect(village.occupantAt({ x: 10, y: 10 })).toBe("b1");
    expect(village.occupantAt({ x: 12, y: 12 })).toBe("b1");
    expect(village.occupantAt({ x: 13, y: 13 })).toBeUndefined();
  });

  it("rejects overlapping placement with the conflicting cells", () => {
    const village = makeVillage();
    village.placeBuilding(building("b1", "cannon", 10, 10));
    const result = village.placeBuilding(building("b2", "cannon", 12, 12));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("OVERLAP");
      if (result.error.kind === "OVERLAP")
        expect(result.error.cells).toContainEqual({ x: 12, y: 12 });
    }
    expect(village.buildingCount).toBe(1);
  });

  it("rejects out-of-bounds placement", () => {
    const village = makeVillage();
    const result = village.placeBuilding(building("b1", "town_hall", 42, 42));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("OUT_OF_BOUNDS");
  });

  it("rejects an unknown definition", () => {
    const village = makeVillage();
    const result = village.placeBuilding(building("b1", "laser_moat", 0, 0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("UNKNOWN_DEFINITION");
  });

  it("frees tiles when a building is removed, allowing reuse", () => {
    const village = makeVillage();
    village.placeBuilding(building("b1", "cannon", 10, 10));
    village.removeBuilding(brand<"Building">("b1"));
    expect(village.occupantAt({ x: 10, y: 10 })).toBeUndefined();
    const reuse = village.placeBuilding(building("b2", "cannon", 10, 10));
    expect(reuse.ok).toBe(true);
  });

  it("moves a building without self-overlap and updates occupancy", () => {
    const village = makeVillage();
    village.placeBuilding(building("b1", "cannon", 10, 10));
    const moved = village.transformBuilding(brand<"Building">("b1"), { x: 11, y: 10 }, 0);
    expect(moved.ok).toBe(true);
    expect(village.occupantAt({ x: 10, y: 10 })).toBeUndefined();
    expect(village.occupantAt({ x: 13, y: 12 })).toBe("b1");
  });
});

describe("Village walls", () => {
  it("adds and removes a wall", () => {
    const village = makeVillage();
    const added = village.addWall({ id: brand<"Wall">("w1"), position: { x: 5, y: 5 } });
    expect(added.ok).toBe(true);
    expect(village.wallCount).toBe(1);
    expect(village.occupantAt({ x: 5, y: 5 })).toBe("w1");
    village.removeWall(brand<"Wall">("w1"));
    expect(village.wallCount).toBe(0);
  });

  it("prevents a wall from overlapping a building", () => {
    const village = makeVillage();
    village.placeBuilding(building("b1", "cannon", 10, 10));
    const result = village.addWall({ id: brand<"Wall">("w1"), position: { x: 11, y: 11 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("OVERLAP");
  });
});

describe("Village snapshot round-trip", () => {
  it("serializes and rebuilds an identical layout", () => {
    const village = makeVillage();
    village.placeBuilding(building("b1", "cannon", 10, 10));
    village.placeBuilding(building("b2", "air_defense", 20, 20));
    village.addWall({ id: brand<"Wall">("w1"), position: { x: 5, y: 5 } });

    const snapshot = village.toSnapshot();
    const rebuilt = Village.fromSnapshot(snapshot, createTestCatalog());
    expect(rebuilt.ok).toBe(true);
    if (rebuilt.ok) {
      expect(rebuilt.value.buildingCount).toBe(2);
      expect(rebuilt.value.wallCount).toBe(1);
      expect(rebuilt.value.toSnapshot()).toEqual(snapshot);
    }
  });
});
