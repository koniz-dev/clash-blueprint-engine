import { describe, expect, it } from "vitest";
import { parseBuildingDefinition, parseRulePack } from "./schema.js";

describe("parseBuildingDefinition", () => {
  it("accepts a valid definition", () => {
    const result = parseBuildingDefinition({
      id: "cannon",
      name: "Cannon",
      category: "defense",
      width: 3,
      height: 3,
      minTier: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts any non-empty category (validated against the game pack, not here)", () => {
    const result = parseBuildingDefinition({
      id: "x",
      name: "X",
      category: "superweapon",
      width: 3,
      height: 3,
      minTier: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty category", () => {
    const result = parseBuildingDefinition({
      id: "x",
      name: "X",
      category: "",
      width: 3,
      height: 3,
      minTier: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-positive dimensions", () => {
    const result = parseBuildingDefinition({
      id: "x",
      name: "X",
      category: "defense",
      width: 0,
      height: 3,
      minTier: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues.join()).toMatch(/width/);
  });

  it("rejects unknown extra keys (strict schema)", () => {
    const result = parseBuildingDefinition({
      id: "x",
      name: "X",
      category: "defense",
      width: 3,
      height: 3,
      minTier: 1,
      surpriseField: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseRulePack", () => {
  it("accepts a valid pack and defaults required to empty", () => {
    const result = parseRulePack({
      tier: 8,
      gridSize: 44,
      walls: 225,
      buildings: [{ id: "cannon", maxCount: 5 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.required).toEqual([]);
  });

  it("rejects a pack missing required numeric fields", () => {
    const result = parseRulePack({ tier: 8, buildings: [] });
    expect(result.ok).toBe(false);
  });

  it("defaults spatial to empty for legacy packs (backward compatible)", () => {
    const result = parseRulePack({
      tier: 8,
      gridSize: 44,
      walls: 225,
      buildings: [{ id: "cannon", maxCount: 5 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.spatial).toEqual([]);
  });

  it("round-trips spatial rules and applies metric/severity defaults", () => {
    const result = parseRulePack({
      tier: 8,
      gridSize: 44,
      walls: 225,
      buildings: [{ id: "air_defense", maxCount: 3 }],
      spatial: [
        { type: "minSpacing", target: { id: "air_defense" }, minDistance: 8 },
        { type: "centered", target: { category: "townhall" }, tolerance: 6 },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const [spacing, centered] = result.value.spatial;
      expect(spacing).toMatchObject({ metric: "chebyshev", severity: "warning" });
      expect(centered).toMatchObject({ severity: "suggestion" });
    }
  });

  it("rejects an unknown spatial rule type", () => {
    const result = parseRulePack({
      tier: 8,
      gridSize: 44,
      walls: 225,
      buildings: [],
      spatial: [{ type: "adjacency", target: { id: "cannon" }, minDistance: 3 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive distance in a spatial rule", () => {
    const result = parseRulePack({
      tier: 8,
      gridSize: 44,
      walls: 225,
      buildings: [],
      spatial: [{ type: "minSpacing", target: { id: "cannon" }, minDistance: 0 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a spatial rule with an empty target selector", () => {
    const result = parseRulePack({
      tier: 8,
      gridSize: 44,
      walls: 225,
      buildings: [],
      spatial: [{ type: "centered", target: {}, tolerance: 4 }],
    });
    expect(result.ok).toBe(false);
  });
});
