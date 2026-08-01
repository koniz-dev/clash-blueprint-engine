export {
  type Recommendation,
  type RecommendationPriority,
  type RecommendationCategory,
  type SuggestedAction,
  type AttackProbe,
  type Advisor,
  type AdvisorContext,
  type AiReport,
} from "./types.js";
export { searchBetterPlacement, type PlacementSuggestion } from "./placement-search.js";
export { runAttackProbes, type ProbeOptions } from "./probes.js";
export { weakPointsAdvisor } from "./advisors/weak-points.js";
export { placementAdvisor } from "./advisors/placement.js";
export { simulationProbeAdvisor } from "./advisors/simulation-probe.js";
export {
  RecommendationEngine,
  recommendImprovements,
  createDefaultAdvisors,
  type RecommendConfig,
} from "./engine.js";
