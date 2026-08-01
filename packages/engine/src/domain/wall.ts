import type { EntityId, GridVec } from "@clash/shared";

export type WallId = EntityId<"Wall">;

/**
 * A single wall piece occupying one tile. Walls are modelled as independent
 * 1×1 objects (as in Clash of Clans) rather than as polylines, which keeps
 * add/remove/paint operations and compartment detection uniform.
 */
export interface WallSegment {
  readonly id: WallId;
  readonly position: GridVec;
}

export function wallKey(position: GridVec): string {
  return `${position.x},${position.y}`;
}
