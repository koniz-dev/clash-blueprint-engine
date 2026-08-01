export {
  type Direction,
  DIRECTIONS,
  type WeakPoint,
  type WeakPointSeverity,
  type DefenseUnit,
  type AnalyzedBuilding,
  type AnalysisContext,
  type Metric,
  type MetricResult,
  type Grade,
  type DefenseScore,
} from "./types.js";
export { type Compartment, type CompartmentAnalysis, analyzeCompartments } from "./compartments.js";
export { buildAnalysisContext } from "./model.js";
export { LayoutAnalyzer, analyzeLayout } from "./analyzer.js";
export {
  createDefaultMetrics,
  coreProtectionMetric,
  storageProtectionMetric,
  airCoverageMetric,
  groundCoverageMetric,
  entryPointsMetric,
  wallEfficiencyMetric,
  compartmentQualityMetric,
} from "./metrics/index.js";
