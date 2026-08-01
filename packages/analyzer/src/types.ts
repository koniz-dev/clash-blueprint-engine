import type { BuildingCatalog, Grid, Village } from "@clash/engine";
import type { Vec2 } from "@clash/shared";
import type { CompartmentAnalysis } from "./compartments.js";

export type Direction = "north" | "east" | "south" | "west";
export const DIRECTIONS: ReadonlyArray<Direction> = ["north", "east", "south", "west"];

export type WeakPointSeverity = "critical" | "weak" | "info";

/** A human-readable finding with an actionable recommendation. */
export interface WeakPoint {
  readonly metricId: string;
  readonly severity: WeakPointSeverity;
  readonly message: string;
  readonly recommendation?: string;
  readonly area?: Direction | "center" | "overall";
  readonly subjects?: ReadonlyArray<string>;
}

/** A single defensive structure with the combat metadata analysis needs. */
export interface DefenseUnit {
  readonly id: string;
  readonly name: string;
  readonly definitionId: string;
  readonly center: Vec2;
  readonly range: number;
  readonly targetsAir: boolean;
  readonly targetsGround: boolean;
  readonly splash: boolean;
}

/** A building enriched with its geometric centre, for distance/direction math. */
export interface AnalyzedBuilding {
  readonly id: string;
  readonly name: string;
  readonly definitionId: string;
  readonly category: string;
  readonly center: Vec2;
}

/**
 * Everything the metrics read, precomputed once. Metrics are pure functions of
 * this context — no re-scanning the village per metric.
 */
export interface AnalysisContext {
  readonly village: Village;
  readonly catalog: BuildingCatalog;
  readonly grid: Grid;
  readonly center: Vec2;
  readonly buildings: ReadonlyArray<AnalyzedBuilding>;
  readonly defenses: ReadonlyArray<DefenseUnit>;
  /** The core/HQ building (designated by the game's `coreCategory`), if present. */
  readonly core: AnalyzedBuilding | undefined;
  readonly storages: ReadonlyArray<AnalyzedBuilding>;
  readonly compartments: CompartmentAnalysis;
}

export interface MetricResult {
  readonly metricId: string;
  readonly label: string;
  /** 0–100 sub-score for this metric. */
  readonly score: number;
  readonly weight: number;
  readonly weakPoints: ReadonlyArray<WeakPoint>;
  readonly details: Readonly<Record<string, number>>;
}

/**
 * A scoring dimension. The analyzer holds a weighted list of these; adding a
 * dimension is registering a `Metric`, not editing the analyzer (composition).
 */
export interface Metric {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  evaluate(context: AnalysisContext): MetricResult;
}

export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

export interface DefenseScore {
  /** 0–100 weighted overall score. */
  readonly overall: number;
  readonly grade: Grade;
  readonly metrics: ReadonlyArray<MetricResult>;
  /** All weak points across metrics, most severe first. */
  readonly weakPoints: ReadonlyArray<WeakPoint>;
}
