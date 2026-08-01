import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { recommendImprovements } from "@clash/ai";
import { analyzeLayout } from "@clash/analyzer";
import { Village, type GameRules } from "@clash/engine";
import { jsonExporter, rendererExporter } from "@clash/exporter";
import { jsonImporter } from "@clash/importer";
import { PluginRegistry } from "@clash/plugins";
import { asciiRenderer, buildDocument, builtinRenderers, svgRenderer } from "@clash/renderer";
import { ValidationEngine, gameRulesFrom } from "@clash/rules-engine";
import { loadGamePack } from "@clash/rules-engine/node";
import { simulateAttack } from "@clash/simulation";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = new URL("../../../", import.meta.url); // examples/pipeline/src -> repo root
const CLASH_DIR = fileURLToPath(new URL("data/games/clash-of-clans/", ROOT));
const TEMPLATE = fileURLToPath(new URL("data/games/clash-of-clans/templates/starter.json", ROOT));

/**
 * Exercises the whole stack as one flow, against the real Clash of Clans game
 * pack: load pack → import a saved blueprint → rebuild the aggregate →
 * validate → render → analyze → simulate → recommend → export → re-import,
 * threading the pack's `GameRules` throughout. If any package's contract drifts
 * (or the game-agnostic wiring breaks), this test breaks.
 */
describe("full blueprint pipeline (real Clash of Clans pack)", () => {
  let loaded: Awaited<ReturnType<typeof loadGamePack>>;
  let templateJson: string;
  let rules: GameRules;

  beforeAll(async () => {
    loaded = await loadGamePack(CLASH_DIR);
    templateJson = await readFile(TEMPLATE, "utf8");
    if (loaded.ok) rules = gameRulesFrom(loaded.value.game);
  });

  it("loads the pack, imports the template, and rebuilds a village", () => {
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const imported = jsonImporter.import(templateJson, TEMPLATE);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const village = Village.fromSnapshot(imported.value, loaded.value.catalog);
    expect(village.ok).toBe(true);
    if (village.ok) expect(village.value.buildingCount).toBe(12);
  });

  it("validates the imported template as a legal Town Hall 8 layout", () => {
    if (!loaded.ok) throw new Error("game pack failed to load");
    const imported = jsonImporter.import(templateJson, TEMPLATE);
    if (!imported.ok) throw new Error("import failed");
    const rebuilt = Village.fromSnapshot(imported.value, loaded.value.catalog);
    if (!rebuilt.ok) throw new Error("rebuild failed");

    const th8 = loaded.value.ruleSets.get(8);
    if (!th8) throw new Error("TH8 rules missing");
    const report = new ValidationEngine().validate(rebuilt.value, th8, loaded.value.catalog, rules);
    expect(report.errors).toBe(0);
    expect(report.isValid).toBe(true);
  });

  it("renders the template using the pack's tier label", () => {
    if (!loaded.ok) throw new Error("game pack failed to load");
    const imported = jsonImporter.import(templateJson, TEMPLATE);
    if (!imported.ok) throw new Error("import failed");
    const rebuilt = Village.fromSnapshot(imported.value, loaded.value.catalog);
    if (!rebuilt.ok) throw new Error("rebuild failed");

    const doc = buildDocument(rebuilt.value, loaded.value.catalog, { tierLabel: rules.tierLabel });
    expect(asciiRenderer.render(doc.scene)).toContain("Town Hall 8");
    expect(svgRenderer.render(doc.scene)).toContain("<svg");
    for (const renderer of builtinRenderers) {
      expect(renderer.render(doc.scene).length).toBeGreaterThan(0);
    }
  });

  it("analyzes the imported template and produces a graded defense score", () => {
    if (!loaded.ok) throw new Error("game pack failed to load");
    const imported = jsonImporter.import(templateJson, TEMPLATE);
    if (!imported.ok) throw new Error("import failed");
    const rebuilt = Village.fromSnapshot(imported.value, loaded.value.catalog);
    if (!rebuilt.ok) throw new Error("rebuild failed");

    const score = analyzeLayout(rebuilt.value, loaded.value.catalog, rules);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(["S", "A", "B", "C", "D", "F"]).toContain(score.grade);
    expect(score.metrics.length).toBeGreaterThan(0);
    for (const weak of score.weakPoints) {
      expect(weak.message.length).toBeGreaterThan(0);
    }
  });

  it("simulates an attack on the imported template and reports a result", () => {
    if (!loaded.ok) throw new Error("game pack failed to load");
    const imported = jsonImporter.import(templateJson, TEMPLATE);
    if (!imported.ok) throw new Error("import failed");
    const rebuilt = Village.fromSnapshot(imported.value, loaded.value.catalog);
    if (!rebuilt.ok) throw new Error("rebuild failed");

    const result = simulateAttack(
      rebuilt.value,
      loaded.value.catalog,
      [
        { troopId: "giant", position: { x: 2, y: 2 } },
        { troopId: "giant", position: { x: 3, y: 2 } },
        { troopId: "wizard", position: { x: 2, y: 3 } },
        { troopId: "barbarian", position: { x: 4, y: 2 } },
      ],
      { options: { maxSeconds: 90, frameSeconds: 1 }, rules },
    );

    expect(result.destructionPercent).toBeGreaterThanOrEqual(0);
    expect(result.destructionPercent).toBeLessThanOrEqual(100);
    expect(result.stars).toBeGreaterThanOrEqual(0);
    expect(result.stars).toBeLessThanOrEqual(3);
    expect(result.timeline.length).toBeGreaterThan(0);
    const times = result.timeline.map((f) => f.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("produces ranked, actionable AI recommendations for the template", () => {
    if (!loaded.ok) throw new Error("game pack failed to load");
    const imported = jsonImporter.import(templateJson, TEMPLATE);
    if (!imported.ok) throw new Error("import failed");
    const rebuilt = Village.fromSnapshot(imported.value, loaded.value.catalog);
    if (!rebuilt.ok) throw new Error("rebuild failed");

    const report = recommendImprovements(rebuilt.value, loaded.value.catalog, {
      probeOptions: { maxSeconds: 60 },
      rules,
    });

    expect(report.defenseScore.overall).toBeGreaterThanOrEqual(0);
    expect(report.probes).toHaveLength(4);
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const ranks = report.recommendations.map((r) => rank[r.priority]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const rec of report.recommendations) {
      expect(rec.title.length).toBeGreaterThan(0);
      expect(rec.rationale.length).toBeGreaterThan(0);
    }
    for (const rec of report.recommendations) {
      if (rec.action?.type === "move") {
        expect(rebuilt.value.getBuilding(rec.action.buildingId as never)).toBeDefined();
      }
    }
  });

  it("drives everything through the plugin registry and round-trips JSON", () => {
    if (!loaded.ok) throw new Error("game pack failed to load");

    const registry = new PluginRegistry();
    for (const renderer of builtinRenderers) registry.registerRenderer(renderer);
    registry.registerImporter(jsonImporter);
    registry.registerExporter(jsonExporter);
    registry.registerExporter(rendererExporter(svgRenderer));

    expect(registry.renderers()).toHaveLength(3);
    expect(
      registry
        .exporters()
        .map((e) => e.id)
        .sort(),
    ).toEqual(["json", "svg-export"]);

    const imported = registry.getImporter("json")!.import(templateJson, TEMPLATE);
    if (!imported.ok) throw new Error("import failed");
    const village = Village.fromSnapshot(imported.value, loaded.value.catalog);
    if (!village.ok) throw new Error("rebuild failed");

    const doc = buildDocument(village.value, loaded.value.catalog, { tierLabel: rules.tierLabel });
    const exported = registry.getExporter("json")!.export(doc, "roundtrip");
    expect(exported.filename).toBe("roundtrip.json");

    const reimported = registry.getImporter("json")!.import(exported.content, "roundtrip");
    expect(reimported.ok).toBe(true);
    if (reimported.ok) {
      expect(reimported.value.buildings).toHaveLength(12);
      expect(reimported.value).toEqual(imported.value);
    }
  });
});
