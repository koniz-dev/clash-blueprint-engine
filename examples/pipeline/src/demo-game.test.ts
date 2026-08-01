import { fileURLToPath } from "node:url";
import { analyzeLayout } from "@clash/analyzer";
import { VillageEditor, type GameRules } from "@clash/engine";
import { asciiRenderer, buildScene } from "@clash/renderer";
import { ValidationEngine, gameRulesFrom } from "@clash/rules-engine";
import { loadGamePack } from "@clash/rules-engine/node";
import { simulateAttack } from "@clash/simulation";
import { beforeAll, describe, expect, it } from "vitest";

const KEEP_SIEGE_DIR = fileURLToPath(new URL("../../../data/games/keep-siege/", import.meta.url));

/**
 * Proof of the game-agnostic abstraction: a *second* game ("Keep Siege") with a
 * different progression axis ("Keep Level"), a different core category ("keep"),
 * and different building categories ("turret", "vault", "snare") runs through
 * validation, analysis, simulation and rendering with ZERO engine code changes —
 * it exists purely as data under `data/games/keep-siege/`.
 */
describe("second game pack: Keep Siege (zero engine code)", () => {
  let loaded: Awaited<ReturnType<typeof loadGamePack>>;
  let rules: GameRules;

  beforeAll(async () => {
    loaded = await loadGamePack(KEEP_SIEGE_DIR);
    if (loaded.ok) rules = gameRulesFrom(loaded.value.game);
  });

  it("loads with its own tier label, core category and custom categories", () => {
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.game.tier.label).toBe("Keep Level");
    expect(loaded.value.game.coreCategory).toBe("keep");
    expect(loaded.value.game.categories.has("turret")).toBe(true);
    expect(loaded.value.game.categories.has("snare")).toBe(true);
    expect(loaded.value.catalog.has("keep")).toBe(true);
  });

  function buildBase() {
    if (!loaded.ok) throw new Error("keep-siege pack failed to load");
    const editor = VillageEditor.forGridSize(40, loaded.value.catalog, 3);
    editor.addBuilding("keep", { x: 18, y: 18 });
    editor.addBuilding("turret", { x: 10, y: 10 });
    editor.addBuilding("gold_vault", { x: 24, y: 24 });
    editor.addBuilding("spike_snare", { x: 5, y: 5 });
    return editor;
  }

  it("validates a legal Keep Siege base against its own rule pack", () => {
    if (!loaded.ok) throw new Error("pack failed to load");
    const level3 = loaded.value.ruleSets.get(3);
    if (!level3) throw new Error("level-3 rules missing");
    const report = new ValidationEngine().validate(
      buildBase().village,
      level3,
      loaded.value.catalog,
      rules,
    );
    expect(report.isValid).toBe(true);
  });

  it("recognizes the data-defined core in analysis (no 'missing core' error)", () => {
    if (!loaded.ok) throw new Error("pack failed to load");
    const score = analyzeLayout(buildBase().village, loaded.value.catalog, rules);
    const coreMissing = score.weakPoints.some(
      (w) => w.metricId === "core-protection" && w.message.includes("no core building"),
    );
    expect(coreMissing).toBe(false);
  });

  it("treats the data-declared snare as passable + non-targetable in simulation", () => {
    if (!loaded.ok) throw new Error("pack failed to load");
    const result = simulateAttack(
      buildBase().village,
      loaded.value.catalog,
      [{ troopId: "giant", position: { x: 0, y: 0 } }],
      { options: { maxSeconds: 30 }, rules },
    );
    // keep + turret + gold_vault are targetable structures; the snare is not.
    expect(result.buildingsTotal).toBe(3);
  });

  it("renders with the pack's tier label", () => {
    if (!loaded.ok) throw new Error("pack failed to load");
    const scene = buildScene(buildBase().village, loaded.value.catalog, {
      tierLabel: rules.tierLabel,
    });
    expect(asciiRenderer.render(scene)).toContain("Keep Level 3");
  });
});
