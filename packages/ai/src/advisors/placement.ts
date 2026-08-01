import { analyzeLayout } from "@clash/analyzer";
import type { BuildingCatalog, Village } from "@clash/engine";
import type { Vec2 } from "@clash/shared";
import { searchBetterPlacement } from "../placement-search.js";
import type { Advisor, AdvisorContext, Recommendation } from "../types.js";

function gridCenter(village: Village): Vec2 {
  return { x: village.grid.width / 2, y: village.grid.height / 2 };
}

function buildingName(context: AdvisorContext, definitionId: string): string {
  return context.catalog.get(definitionId)?.name ?? definitionId;
}

/** Ids of buildings of a given category, resolved through the catalog. */
function buildingsOfCategory(
  village: Village,
  catalog: BuildingCatalog,
  category: string,
): string[] {
  const ids: string[] = [];
  for (const building of village.listBuildings()) {
    if (catalog.get(building.definitionId)?.category === category) ids.push(building.id);
  }
  return ids;
}

/**
 * Proposes concrete relocations for the core building and exposed storages.
 * Each candidate is validated on a clone of the village and only surfaced if it
 * *measurably raises* the overall defense score — so every "move X" it emits is
 * legal and provably better, with the projected score attached.
 */
export const placementAdvisor: Advisor = {
  id: "placement",
  advise(context): Recommendation[] {
    const { village, catalog, rules } = context;
    const evaluate = (v: Village): number => analyzeLayout(v, catalog, rules).overall;
    const center = gridCenter(village);
    const recommendations: Recommendation[] = [];
    let counter = 0;

    const coreScore =
      context.score.metrics.find((m) => m.metricId === "core-protection")?.score ?? 100;
    if (coreScore < 70 && rules.coreCategory !== undefined) {
      for (const coreId of buildingsOfCategory(village, catalog, rules.coreCategory)) {
        const suggestion = searchBetterPlacement(village, catalog, coreId, center, evaluate);
        if (!suggestion) continue;
        const coreName =
          catalog.get(village.getBuilding(coreId as never)?.definitionId ?? "")?.name ??
          "core building";
        recommendations.push({
          id: `placement-${++counter}`,
          advisorId: this.id,
          category: "core",
          priority: coreScore < 40 ? "high" : "medium",
          title: `Move the ${coreName} deeper into the core`,
          detail: `Relocate the ${coreName} to (${suggestion.position.x}, ${suggestion.position.y}) — nearer the centre and harder to reach.`,
          rationale: `Core protection is ${coreScore}/100; the move raises the overall defense score from ${suggestion.baseline} to ${suggestion.score}.`,
          action: { type: "move", buildingId: coreId, to: suggestion.position },
          projectedScore: suggestion.score,
          subjects: [coreId],
        });
      }
    }

    // Only the storages the analyzer flagged as exposed.
    const exposedStorageIds = new Set(
      context.score.weakPoints
        .filter((w) => w.metricId === "storage-protection")
        .flatMap((w) => w.subjects ?? []),
    );
    for (const storageId of exposedStorageIds) {
      const suggestion = searchBetterPlacement(village, catalog, storageId, center, evaluate);
      if (!suggestion) continue;
      const definitionId = village.getBuilding(storageId as never)?.definitionId ?? "storage";
      recommendations.push({
        id: `placement-${++counter}`,
        advisorId: this.id,
        category: "defense-placement",
        priority: "medium",
        title: `Pull ${buildingName(context, definitionId)} into the core`,
        detail: `Move it to (${suggestion.position.x}, ${suggestion.position.y}) to slow resource raids.`,
        rationale: `Exposed storage; the move raises the overall defense score from ${suggestion.baseline} to ${suggestion.score}.`,
        action: { type: "move", buildingId: storageId, to: suggestion.position },
        projectedScore: suggestion.score,
        subjects: [storageId],
      });
    }

    return recommendations;
  },
};
