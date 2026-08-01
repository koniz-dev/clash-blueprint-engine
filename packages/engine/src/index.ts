// --- Domain layer ---
export { Grid, type GridConfig } from "./domain/grid.js";
export {
  type Rotation,
  ROTATIONS,
  isRotation,
  normalizeRotation,
  rotateClockwise,
  rotateCounterClockwise,
  swapsAxes,
} from "./domain/rotation.js";
export {
  type BuildingCategory,
  type BuildingDefinition,
  type BuildingCatalog,
  InMemoryBuildingCatalog,
} from "./domain/building-definition.js";
export { type BuildingId, type BuildingInstance } from "./domain/building.js";
export { type GameRules, DEFAULT_GAME_RULES } from "./domain/game-rules.js";
export { type WallId, type WallSegment, wallKey } from "./domain/wall.js";
export { type Footprint, computeFootprint } from "./domain/footprint.js";
export { TileOccupancyIndex } from "./domain/spatial-index.js";
export { type EngineError, describeEngineError } from "./domain/errors.js";
export { Village, type VillageSnapshot } from "./domain/village.js";

// --- Application layer ---
export { type Command, type CommandContext } from "./application/command.js";
export { CommandStack } from "./application/command-stack.js";
export { EventStore } from "./application/event-store.js";
export { type DomainEvent, type DomainEventType, type StoredEvent } from "./application/events.js";
export { AddBuildingCommand, type AddBuildingParams } from "./application/commands/add-building.js";
export {
  MoveBuildingCommand,
  type MoveBuildingParams,
} from "./application/commands/move-building.js";
export {
  RotateBuildingCommand,
  type RotateBuildingParams,
} from "./application/commands/rotate-building.js";
export {
  RemoveBuildingCommand,
  type RemoveBuildingParams,
} from "./application/commands/remove-building.js";
export { AddWallCommand, type AddWallParams } from "./application/commands/add-wall.js";
export { RemoveWallCommand, type RemoveWallParams } from "./application/commands/remove-wall.js";
export { MoveWallCommand, type MoveWallParams } from "./application/commands/move-wall.js";
export { MacroCommand } from "./application/commands/macro.js";
export { VillageEditor, type VillageEditorOptions } from "./application/village-editor.js";
