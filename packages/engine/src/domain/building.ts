import type { EntityId, GridVec } from "@clash/shared";
import type { Rotation } from "./rotation.js";

export type BuildingId = EntityId<"Building">;

/**
 * A building placed on the grid. Plain, serializable data — behaviour lives in
 * the {@link ./village.ts} aggregate and pure helpers so instances rebuild
 * cleanly from an event log or a saved blueprint.
 */
export interface BuildingInstance {
  readonly id: BuildingId;
  readonly definitionId: string;
  readonly position: GridVec;
  readonly rotation: Rotation;
}
