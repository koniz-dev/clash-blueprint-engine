import { VillageEditor } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { buildCatalog, buildRuleSet, type RuleSet } from "../rule-set.js";
import { parseBuildingDefinitions, parseRulePack } from "../schema.js";
import type { ValidationContext } from "./types.js";
import {
  spatialCenteredRule,
  spatialEdgeBufferRule,
  spatialMinSpacingRule,
  spatialProximityRule,
} from "./spatial-rules.js";

const DEFS = parseBuildingDefinitions([
  { id: "town_hall", name: "Town Hall", category: "townhall", width: 4, height: 4, minTier: 1 },
  { id: "cannon", name: "Cannon", category: "defense", width: 3, height: 3, minTier: 1 },
  { id: "air_defense", name: "Air Defense", category: "defense", width: 3, height: 3, minTier: 1 },
  { id: "x_bow", name: "X-Bow", category: "defense", width: 3, height: 3, minTier: 1 },
]);

function catalog() {
  if (!DEFS.ok) throw new Error("fixture definitions failed to parse");
  return buildCatalog(DEFS.value);
}

/** Build a RuleSet carrying an arbitrary `spatial` array (defaults applied). */
function ruleSetWith(spatial: unknown[]): RuleSet {
  const pack = parseRulePack({
    tier: 8,
    gridSize: 44,
    walls: 100,
    required: [],
    buildings: [
      { id: "town_hall", maxCount: 4 },
      { id: "cannon", maxCount: 9 },
      { id: "air_defense", maxCount: 9 },
      { id: "x_bow", maxCount: 9 },
    ],
    spatial,
  });
  if (!pack.ok) throw new Error(`fixture pack failed to parse: ${JSON.stringify(pack.error)}`);
  return buildRuleSet(pack.value);
}

function editor() {
  return VillageEditor.forGridSize(44, catalog(), 8);
}

function ctx(ed: VillageEditor, ruleSet: RuleSet): ValidationContext {
  return { village: ed.village, ruleSet, catalog: catalog(), tierLabel: "Town Hall" };
}

describe("spatialMinSpacingRule", () => {
  const spacing = [{ type: "minSpacing", target: { id: "air_defense" }, minDistance: 8 }];

  it("flags a pair closer than minDistance and lists both as subjects", () => {
    const ed = editor();
    ed.addBuilding("air_defense", { x: 0, y: 0 }); // center (1.5, 1.5)
    ed.addBuilding("air_defense", { x: 5, y: 0 }); // center (6.5, 1.5) → chebyshev 5 < 8
    const [issue] = spatialMinSpacingRule.validate(ctx(ed, ruleSetWith(spacing)));
    expect(issue?.code).toBe("TOO_CLOSE");
    expect(issue?.severity).toBe("warning");
    expect(issue?.subjects).toHaveLength(2);
  });

  it("passes when the gap is exactly minDistance (boundary is allowed)", () => {
    const ed = editor();
    ed.addBuilding("air_defense", { x: 0, y: 0 }); // center (1.5, 1.5)
    ed.addBuilding("air_defense", { x: 8, y: 0 }); // center (9.5, 1.5) → chebyshev 8 == 8
    expect(spatialMinSpacingRule.validate(ctx(ed, ruleSetWith(spacing)))).toHaveLength(0);
  });

  it("de-duplicates subjects across overlapping close pairs", () => {
    const ed = editor();
    ed.addBuilding("air_defense", { x: 0, y: 0 });
    ed.addBuilding("air_defense", { x: 4, y: 0 });
    ed.addBuilding("air_defense", { x: 8, y: 0 }); // all within 8 of a neighbour
    const [issue] = spatialMinSpacingRule.validate(ctx(ed, ruleSetWith(spacing)));
    expect(issue?.subjects).toHaveLength(3);
  });
});

describe("spatialEdgeBufferRule", () => {
  const buffer = [{ type: "edgeBuffer", buffer: 2 }];

  it("flags a building whose footprint enters the border band", () => {
    const ed = editor();
    ed.addBuilding("cannon", { x: 0, y: 10 }); // cells x 0..2 → x < 2
    const [issue] = spatialEdgeBufferRule.validate(ctx(ed, ruleSetWith(buffer)));
    expect(issue?.code).toBe("NEAR_EDGE");
    expect(issue?.subjects).toEqual([ed.village.listBuildings()[0]!.id]);
  });

  it("flags the far edge (grid width minus buffer)", () => {
    const ed = editor();
    ed.addBuilding("cannon", { x: 41, y: 10 }); // cells x 41..43 → 42 >= 44-2
    expect(spatialEdgeBufferRule.validate(ctx(ed, ruleSetWith(buffer)))).toHaveLength(1);
  });

  it("passes a building sitting exactly on the buffer line", () => {
    const ed = editor();
    ed.addBuilding("cannon", { x: 2, y: 10 }); // cells x 2..4 → none < 2
    expect(spatialEdgeBufferRule.validate(ctx(ed, ruleSetWith(buffer)))).toHaveLength(0);
  });

  it("only considers the targeted selector when one is given", () => {
    const targeted = [{ type: "edgeBuffer", buffer: 2, target: { id: "air_defense" } }];
    const ed = editor();
    ed.addBuilding("cannon", { x: 0, y: 10 }); // near edge but not targeted
    expect(spatialEdgeBufferRule.validate(ctx(ed, ruleSetWith(targeted)))).toHaveLength(0);
  });
});

describe("spatialCenteredRule", () => {
  const centered = [{ type: "centered", target: { id: "town_hall" }, tolerance: 8 }];

  it("flags a town hall parked in the corner", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 0, y: 0 }); // center (2, 2) → chebyshev 20 > 8
    const [issue] = spatialCenteredRule.validate(ctx(ed, ruleSetWith(centered)));
    expect(issue?.code).toBe("OFF_CENTER");
    expect(issue?.severity).toBe("suggestion");
    expect(issue?.subjects).toHaveLength(1);
  });

  it("passes a town hall within tolerance of the grid center", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 }); // center (22, 22) == grid center
    expect(spatialCenteredRule.validate(ctx(ed, ruleSetWith(centered)))).toHaveLength(0);
  });

  it("passes at exactly the tolerance boundary", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 28, y: 20 }); // center (30, 22) → chebyshev 8 == 8
    expect(spatialCenteredRule.validate(ctx(ed, ruleSetWith(centered)))).toHaveLength(0);
  });
});

describe("spatialProximityRule", () => {
  const proximity = [
    { type: "proximity", target: { id: "x_bow" }, near: { id: "town_hall" }, maxDistance: 10 },
  ];

  it("flags a target too far from any anchor", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 }); // center (22, 22)
    ed.addBuilding("x_bow", { x: 0, y: 0 }); // center (1.5, 1.5) → chebyshev 20.5 > 10
    const [issue] = spatialProximityRule.validate(ctx(ed, ruleSetWith(proximity)));
    expect(issue?.code).toBe("TOO_FAR");
    expect(issue?.subjects).toHaveLength(1);
  });

  it("passes a target within range of an anchor", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    ed.addBuilding("x_bow", { x: 20, y: 25 }); // center (21.5, 26.5) → chebyshev 4.5 <= 10
    expect(spatialProximityRule.validate(ctx(ed, ruleSetWith(proximity)))).toHaveLength(0);
  });

  it("flags the target when no anchor exists at all", () => {
    const ed = editor();
    ed.addBuilding("x_bow", { x: 20, y: 20 }); // no town_hall placed
    expect(spatialProximityRule.validate(ctx(ed, ruleSetWith(proximity)))).toHaveLength(1);
  });
});

describe("category selectors", () => {
  it("minSpacing on a category covers every member definition", () => {
    const spacing = [{ type: "minSpacing", target: { category: "defense" }, minDistance: 8 }];
    const ed = editor();
    ed.addBuilding("cannon", { x: 0, y: 0 });
    ed.addBuilding("air_defense", { x: 5, y: 0 }); // different ids, same category, too close
    const [issue] = spatialMinSpacingRule.validate(ctx(ed, ruleSetWith(spacing)));
    expect(issue?.subjects).toHaveLength(2);
  });
});

describe("inert on packs without spatial rules", () => {
  it("produces no findings when `spatial` is empty", () => {
    const ed = editor();
    ed.addBuilding("air_defense", { x: 0, y: 0 });
    ed.addBuilding("air_defense", { x: 5, y: 0 });
    const rs = ruleSetWith([]);
    expect(spatialMinSpacingRule.validate(ctx(ed, rs))).toHaveLength(0);
    expect(spatialEdgeBufferRule.validate(ctx(ed, rs))).toHaveLength(0);
    expect(spatialCenteredRule.validate(ctx(ed, rs))).toHaveLength(0);
    expect(spatialProximityRule.validate(ctx(ed, rs))).toHaveLength(0);
  });
});
