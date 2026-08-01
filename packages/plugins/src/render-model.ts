import type { BuildingCategory, Rotation, VillageSnapshot } from "@clash/engine";
import type { GridVec, Rect } from "@clash/shared";

/**
 * The **render model** — a flat, framework-agnostic description of a layout
 * that every renderer and exporter consumes. Decoupling renderers from the
 * `Village` aggregate means a renderer needs no catalog lookups, no engine
 * types beyond these, and can run against a document loaded from disk.
 */
export interface SceneBuilding {
  readonly id: string;
  readonly definitionId: string;
  readonly name: string;
  readonly category: BuildingCategory;
  readonly bounds: Rect;
  readonly cells: ReadonlyArray<GridVec>;
  readonly rotation: Rotation;
}

/** Which orthogonally-adjacent tiles also hold a wall (for auto-connect). */
export interface WallConnections {
  readonly north: boolean;
  readonly east: boolean;
  readonly south: boolean;
  readonly west: boolean;
}

/** Classification of a wall piece by how it connects to its neighbours. */
export type WallShape = "isolated" | "end" | "straight" | "corner" | "tee" | "cross";

export interface SceneWall {
  readonly id: string;
  readonly position: GridVec;
  readonly connections: WallConnections;
  readonly shape: WallShape;
}

export interface Scene {
  readonly grid: { readonly width: number; readonly height: number };
  /** Progression tier of the layout (generic; e.g. Town Hall level). */
  readonly tier: number;
  /** Per-game label for the tier axis, e.g. "Town Hall" or "Keep Level". */
  readonly tierLabel: string;
  readonly buildings: ReadonlyArray<SceneBuilding>;
  readonly walls: ReadonlyArray<SceneWall>;
}

/**
 * A layout packaged for output. `scene` is the enriched, render-friendly view;
 * `snapshot` is the loss-free source used by structural exporters (e.g. JSON).
 */
export interface LayoutDocument {
  readonly snapshot: VillageSnapshot;
  readonly scene: Scene;
}
