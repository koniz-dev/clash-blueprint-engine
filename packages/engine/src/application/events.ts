import type { GridVec } from "@clash/shared";
import type { BuildingId, BuildingInstance } from "../domain/building.js";
import type { Rotation } from "../domain/rotation.js";
import type { VillageSnapshot } from "../domain/village.js";
import type { WallId, WallSegment } from "../domain/wall.js";

/**
 * Facts about what happened, in the past tense. Commands produce events; the
 * {@link ./event-store.ts} records them. Events are the substrate for undo
 * history, timeline replay, debugging and (later) real-time collaboration.
 *
 * Payloads carry enough information to be self-describing — e.g. a move event
 * records both `from` and `to` so it can be inspected or inverted without the
 * surrounding aggregate.
 */
export type DomainEvent =
  | { readonly type: "BuildingPlaced"; readonly building: BuildingInstance }
  | {
      readonly type: "BuildingMoved";
      readonly id: BuildingId;
      readonly from: GridVec;
      readonly to: GridVec;
    }
  | {
      readonly type: "BuildingRotated";
      readonly id: BuildingId;
      readonly from: Rotation;
      readonly to: Rotation;
    }
  | { readonly type: "BuildingDeleted"; readonly building: BuildingInstance }
  | { readonly type: "WallAdded"; readonly wall: WallSegment }
  | { readonly type: "WallRemoved"; readonly wall: WallSegment }
  | {
      readonly type: "WallMoved";
      readonly id: WallId;
      readonly from: GridVec;
      readonly to: GridVec;
    }
  | { readonly type: "LayoutLoaded"; readonly snapshot: VillageSnapshot }
  | {
      readonly type: "LayoutValidated";
      readonly errors: number;
      readonly warnings: number;
      readonly suggestions: number;
    }
  | { readonly type: "SimulationStarted"; readonly units: number; readonly buildings: number }
  | {
      readonly type: "SimulationFinished";
      readonly destructionPercent: number;
      readonly stars: number;
      readonly durationSeconds: number;
    };

export type DomainEventType = DomainEvent["type"];

/** An event as persisted: the fact plus monotonic sequence and a source tag. */
export interface StoredEvent {
  readonly sequence: number;
  readonly event: DomainEvent;
  /** Optional origin (a client id for collaboration, "replay", etc.). */
  readonly source?: string;
}

export type { BuildingId, WallId };
