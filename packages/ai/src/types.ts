import type { DefenseScore, Direction } from "@clash/analyzer";
import type { BuildingCatalog, GameRules, Village } from "@clash/engine";
import type { GridVec } from "@clash/shared";
import type { TroopCatalog } from "@clash/simulation";

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationCategory =
  "core" | "defense-placement" | "walls" | "compartments" | "coverage" | "general";

/**
 * A concrete, machine-actionable change. The editor can apply these directly
 * (they map onto engine commands), which is what makes a recommendation more
 * than advice.
 */
export type SuggestedAction =
  | { readonly type: "move"; readonly buildingId: string; readonly to: GridVec }
  | { readonly type: "addBuilding"; readonly category: string; readonly near: GridVec }
  | { readonly type: "addWalls"; readonly positions: ReadonlyArray<GridVec> };

export interface Recommendation {
  readonly id: string;
  readonly advisorId: string;
  readonly category: RecommendationCategory;
  readonly priority: RecommendationPriority;
  readonly title: string;
  readonly detail: string;
  /** The evidence behind the suggestion (metric scores, probe results). */
  readonly rationale: string;
  readonly action?: SuggestedAction;
  /** For placement suggestions: the projected defense score if applied. */
  readonly projectedScore?: number;
  readonly subjects?: ReadonlyArray<string>;
}

/** Result of a directional attack probe used to locate the weakest approach. */
export interface AttackProbe {
  readonly direction: Direction;
  readonly deployment: GridVec;
  readonly destructionPercent: number;
  readonly stars: number;
  readonly coreDestroyed: boolean;
  readonly durationSeconds: number;
}

/** Precomputed inputs shared by every advisor (analyzer + probe results). */
export interface AdvisorContext {
  readonly village: Village;
  readonly catalog: BuildingCatalog;
  readonly troops: TroopCatalog;
  readonly rules: GameRules;
  readonly score: DefenseScore;
  readonly probes: ReadonlyArray<AttackProbe>;
}

/**
 * A recommendation source. The heuristic advisors ship today; an LLM- or
 * computer-vision-backed advisor implements the same interface and is dropped
 * into the engine's list — no core change (composition over inheritance).
 */
export interface Advisor {
  readonly id: string;
  advise(context: AdvisorContext): Recommendation[];
}

export interface AiReport {
  readonly defenseScore: DefenseScore;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly probes: ReadonlyArray<AttackProbe>;
}
