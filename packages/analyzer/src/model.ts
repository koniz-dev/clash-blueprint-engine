import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type GameRules,
  type Village,
} from "@clash/engine";
import { invariant } from "@clash/shared";
import { analyzeCompartments } from "./compartments.js";
import { gridCenter, rectCenter } from "./geometry.js";
import type { AnalysisContext, AnalyzedBuilding, DefenseUnit } from "./types.js";

/**
 * Precompute everything the metrics need — enriched buildings, defense units
 * with combat metadata, the core building, storages and the compartment
 * analysis — so each metric is a cheap pure read rather than another village
 * scan. Core and storage roles come from the game rules, not category literals.
 */
export function buildAnalysisContext(
  village: Village,
  catalog: BuildingCatalog,
  rules: GameRules = DEFAULT_GAME_RULES,
): AnalysisContext {
  const buildings: AnalyzedBuilding[] = [];
  const defenses: DefenseUnit[] = [];

  for (const instance of village.listBuildings()) {
    const def = catalog.get(instance.definitionId);
    invariant(def, `Analysis: unknown definition "${instance.definitionId}"`);
    const bounds = village.footprintOf(instance).bounds;
    const center = rectCenter(bounds);

    buildings.push({
      id: instance.id,
      name: def.name,
      definitionId: instance.definitionId,
      category: def.category,
      center,
    });

    if (def.attackRange && def.damageType !== "none") {
      const targets = def.targets ?? [];
      defenses.push({
        id: instance.id,
        name: def.name,
        definitionId: instance.definitionId,
        center,
        range: def.attackRange,
        targetsAir: targets.includes("air"),
        targetsGround: targets.includes("ground"),
        splash: def.damageType === "splash",
      });
    }
  }

  return {
    village,
    catalog,
    grid: village.grid,
    center: gridCenter(village.grid),
    buildings,
    defenses,
    core:
      rules.coreCategory === undefined
        ? undefined
        : buildings.find((b) => b.category === rules.coreCategory),
    storages: buildings.filter((b) => rules.hasRole(b.category, "storage")),
    compartments: analyzeCompartments(village),
  };
}
