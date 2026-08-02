// --- Schema & parsing (data boundary) ---
export {
  buildingDefinitionSchema,
  rulePackSchema,
  spatialRuleSchema,
  parseBuildingDefinition,
  parseBuildingDefinitions,
  parseRulePack,
  type BuildingDefinitionJson,
  type RulePackJson,
  type SpatialRuleJson,
  type TargetSelector,
  type DistanceMetric,
  type ParseError,
} from "./schema.js";

// --- Rule sets & catalog ---
export {
  buildRuleSet,
  buildCatalog,
  type RuleSet,
  type BuildingAllowance,
  type RequiredBuilding,
  type SpatialRule,
} from "./rule-set.js";

// --- Game definition (the game-agnostic abstraction) ---
export {
  parseGameDefinition,
  gameRulesFrom,
  type GameDefinition,
  type GameManifestJson,
  type CategoryDescriptor,
} from "./game-definition.js";
// The GameRules port + default live in the engine core; re-exported for convenience.
export { type GameRules, DEFAULT_GAME_RULES } from "@clash/engine";

// --- Validation ---
export {
  type Severity,
  type ValidationIssue,
  type ValidationContext,
  type ValidationRule,
} from "./validation/types.js";
export { ValidationReport } from "./validation/report.js";
export { ValidationEngine } from "./validation/engine.js";
export {
  createDefaultRules,
  requiredBuildingsRule,
  buildingAllowedRule,
  buildingCountRule,
  tierRequirementRule,
  wallLimitRule,
  coordinateValidityRule,
} from "./validation/rules.js";
