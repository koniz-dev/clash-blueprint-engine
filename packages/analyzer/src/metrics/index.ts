import type { Metric } from "../types.js";
import { airCoverageMetric, entryPointsMetric, groundCoverageMetric } from "./coverage.js";
import { storageProtectionMetric, coreProtectionMetric } from "./protection.js";
import { compartmentQualityMetric, wallEfficiencyMetric } from "./walls.js";

export {
  coreProtectionMetric,
  storageProtectionMetric,
  airCoverageMetric,
  groundCoverageMetric,
  entryPointsMetric,
  wallEfficiencyMetric,
  compartmentQualityMetric,
};

/** The default weighted scoring dimensions, most impactful first. */
export function createDefaultMetrics(): Metric[] {
  return [
    coreProtectionMetric,
    storageProtectionMetric,
    airCoverageMetric,
    groundCoverageMetric,
    compartmentQualityMetric,
    wallEfficiencyMetric,
    entryPointsMetric,
  ];
}
