import { EventStore, VillageEditor } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { buildCatalog, buildRuleSet, type RuleSet } from "../rule-set.js";
import { parseBuildingDefinitions, parseRulePack } from "../schema.js";
import { ValidationEngine } from "./engine.js";

const DEFS = parseBuildingDefinitions([
  {
    id: "town_hall",
    name: "Town Hall",
    category: "townhall",
    width: 4,
    height: 4,
    minTier: 1,
  },
  { id: "cannon", name: "Cannon", category: "defense", width: 3, height: 3, minTier: 1 },
  {
    id: "air_defense",
    name: "Air Defense",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 4,
  },
  { id: "x_bow", name: "X-Bow", category: "defense", width: 3, height: 3, minTier: 9 },
]);

function catalog() {
  if (!DEFS.ok) throw new Error("fixture definitions failed to parse");
  return buildCatalog(DEFS.value);
}

function th8RuleSet(): RuleSet {
  const pack = parseRulePack({
    tier: 8,
    gridSize: 44,
    walls: 225,
    required: [{ id: "town_hall", min: 1, max: 1 }],
    buildings: [
      { id: "town_hall", maxCount: 1 },
      { id: "cannon", maxCount: 2 },
      { id: "air_defense", maxCount: 3 },
    ],
  });
  if (!pack.ok) throw new Error("fixture rule pack failed to parse");
  return buildRuleSet(pack.value);
}

function editor() {
  return VillageEditor.forGridSize(44, catalog(), 8);
}

const engine = new ValidationEngine();

describe("ValidationEngine", () => {
  it("flags a missing required Town Hall as an error", () => {
    const report = engine.validate(editor().village, th8RuleSet(), catalog());
    expect(report.isValid).toBe(false);
    expect(report.bySeverity("error").some((i) => i.code === "MISSING_REQUIRED")).toBe(true);
  });

  it("passes a minimal legal layout (no errors)", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    ed.addBuilding("cannon", { x: 10, y: 10 });
    ed.addWall({ x: 0, y: 0 });
    const report = engine.validate(ed.village, th8RuleSet(), catalog());
    expect(report.isValid).toBe(true);
    expect(report.errors).toBe(0);
  });

  it("flags exceeding a building's max count", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    ed.addBuilding("cannon", { x: 0, y: 0 });
    ed.addBuilding("cannon", { x: 4, y: 0 });
    ed.addBuilding("cannon", { x: 8, y: 0 }); // 3 > max 2
    const report = engine.validate(ed.village, th8RuleSet(), catalog());
    const overLimit = report.issues.find((i) => i.code === "OVER_LIMIT");
    expect(overLimit?.severity).toBe("error");
    expect(overLimit?.subjects).toHaveLength(3);
  });

  it("flags a building not allowed at this Town Hall, and warns it unlocks later", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    ed.addBuilding("x_bow", { x: 0, y: 0 });
    const report = engine.validate(ed.village, th8RuleSet(), catalog());
    expect(report.issues.some((i) => i.code === "NOT_ALLOWED")).toBe(true);
    expect(report.issues.some((i) => i.code === "UNLOCKS_LATER" && i.severity === "warning")).toBe(
      true,
    );
  });

  it("suggests adding walls when there are none", () => {
    const ed = editor();
    ed.addBuilding("town_hall", { x: 20, y: 20 });
    const report = engine.validate(ed.village, th8RuleSet(), catalog());
    expect(report.bySeverity("suggestion").some((i) => i.code === "NO_WALLS")).toBe(true);
  });

  it("records a LayoutValidated event with severity counts", () => {
    const ed = editor();
    const events = new EventStore();
    const report = engine.validateAndRecord(ed.village, th8RuleSet(), catalog(), events);
    const stored = events.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.event).toMatchObject({
      type: "LayoutValidated",
      errors: report.errors,
      warnings: report.warnings,
      suggestions: report.suggestions,
    });
  });
});
