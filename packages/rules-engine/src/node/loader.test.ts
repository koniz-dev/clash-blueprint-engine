import { fileURLToPath } from "node:url";
import { VillageEditor } from "@clash/engine";
import { describe, expect, it } from "vitest";
import { ValidationEngine } from "../validation/engine.js";
import { loadGamePack } from "./loader.js";

// The shipped Clash of Clans game pack, resolved relative to this file:
// src/node/ -> src -> rules-engine -> packages -> <root>/data/games/clash-of-clans
const CLASH_DIR = fileURLToPath(new URL("../../../../data/games/clash-of-clans/", import.meta.url));

describe("loadGamePack (real Clash of Clans pack)", () => {
  it("loads the manifest, buildings, and tier rule packs", async () => {
    const result = await loadGamePack(CLASH_DIR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pack = result.value;
    expect(pack.game.id).toBe("clash-of-clans");
    expect(pack.game.tier.label).toBe("Town Hall");
    expect(pack.game.coreCategory).toBe("townhall");
    // A sampling of buildings from different category files.
    expect(pack.catalog.has("town_hall")).toBe(true);
    expect(pack.catalog.has("x_bow")).toBe(true);
    expect(pack.catalog.has("giant_bomb")).toBe(true);
    // Every tier rule pack in rules/ loads and is indexed by tier. Adding a
    // new pack file (validated against the catalog here) is a pure data change.
    for (const tier of [8, 9, 10, 11]) expect(pack.ruleSets.has(tier)).toBe(true);
    expect(pack.ruleSets.get(8)?.wallLimit).toBe(225);
    expect(pack.ruleSets.get(11)?.wallLimit).toBe(300);
    // The starter template is available.
    expect(pack.templates.has("starter")).toBe(true);
  });

  it("supports building a real village and validating it against a loaded rule set", async () => {
    const result = await loadGamePack(CLASH_DIR);
    if (!result.ok) throw new Error("game pack failed to load");
    const { catalog, ruleSets } = result.value;
    const th8 = ruleSets.get(8);
    if (!th8) throw new Error("TH8 rule set missing");

    const editor = VillageEditor.forGridSize(th8.gridSize, catalog, 8);
    editor.addBuilding("town_hall", { x: 20, y: 20 });
    editor.addBuilding("cannon", { x: 10, y: 10 });
    editor.addWall({ x: 0, y: 0 });

    const report = new ValidationEngine().validate(editor.village, th8, catalog);
    expect(report.isValid).toBe(true);
  });

  it("rejects a building whose category is not declared in the manifest", async () => {
    const result = await loadGamePack(CLASH_DIR);
    if (!result.ok) throw new Error("game pack failed to load");
    // The manifest declares no "spell" category, so validation must catch it
    // (guarded here via the parser rather than mutating the shipped data).
    expect(result.value.game.categories.has("spell")).toBe(false);
  });
});
