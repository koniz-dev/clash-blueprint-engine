import type { GridVec, IdGenerator, Result } from "@clash/shared";
import { createSequentialIdGenerator, ok } from "@clash/shared";
import type { BuildingCatalog } from "../domain/building-definition.js";
import type { BuildingId } from "../domain/building.js";
import type { EngineError } from "../domain/errors.js";
import { Grid } from "../domain/grid.js";
import type { Rotation } from "../domain/rotation.js";
import { Village, type VillageSnapshot } from "../domain/village.js";
import type { WallId } from "../domain/wall.js";
import { AddBuildingCommand } from "./commands/add-building.js";
import { AddWallCommand } from "./commands/add-wall.js";
import { MacroCommand } from "./commands/macro.js";
import { MoveBuildingCommand } from "./commands/move-building.js";
import { MoveWallCommand } from "./commands/move-wall.js";
import { RemoveBuildingCommand } from "./commands/remove-building.js";
import { RemoveWallCommand } from "./commands/remove-wall.js";
import { RotateBuildingCommand } from "./commands/rotate-building.js";
import { CommandStack } from "./command-stack.js";
import type { Command, CommandContext } from "./command.js";
import { EventStore } from "./event-store.js";

export interface VillageEditorOptions {
  readonly grid: Grid;
  readonly catalog: BuildingCatalog;
  readonly tier?: number;
  readonly ids?: IdGenerator;
}

/**
 * The primary application-layer facade — the port every adapter (React UI,
 * CLI, tests) drives. It wires the {@link Village} aggregate, the
 * {@link EventStore}, the {@link CommandStack} and an id source together and
 * exposes intention-revealing operations that each return a `Result`.
 *
 * No adapter constructs commands or touches the aggregate directly; they call
 * these methods. That keeps game logic entirely out of the UI.
 */
export class VillageEditor {
  readonly #catalog: BuildingCatalog;
  readonly #ids: IdGenerator;
  #village: Village;
  #events: EventStore;
  #history: CommandStack;

  constructor(options: VillageEditorOptions) {
    this.#catalog = options.catalog;
    this.#ids = options.ids ?? createSequentialIdGenerator("ent");
    this.#village = new Village(options.grid, options.catalog, options.tier ?? 1);
    this.#events = new EventStore();
    this.#history = new CommandStack(this.#context());
  }

  get village(): Village {
    return this.#village;
  }

  get events(): EventStore {
    return this.#events;
  }

  get history(): CommandStack {
    return this.#history;
  }

  // --- Building operations ------------------------------------------------

  addBuilding(
    definitionId: string,
    position: GridVec,
    rotation: Rotation = 0,
  ): Result<BuildingId, EngineError> {
    const command = new AddBuildingCommand({ definitionId, position, rotation });
    const result = this.#history.execute(command);
    if (!result.ok) return result;
    // buildingId is defined after a successful execute.
    return ok(command.buildingId as BuildingId);
  }

  moveBuilding(id: BuildingId, to: GridVec): Result<void, EngineError> {
    return this.#history.execute(new MoveBuildingCommand({ id, to }));
  }

  /**
   * Move several buildings as one atomic, undoable gesture (e.g. dragging a
   * multi-selection). Either every move applies or none does — a mid-batch
   * failure rolls the whole thing back. An empty list is a successful no-op.
   */
  moveBuildings(moves: readonly { id: BuildingId; to: GridVec }[]): Result<void, EngineError> {
    return this.#runBatch(
      "Move buildings",
      moves.map((m) => new MoveBuildingCommand({ id: m.id, to: m.to })),
    );
  }

  moveWall(id: WallId, to: GridVec): Result<void, EngineError> {
    return this.#history.execute(new MoveWallCommand({ id, to }));
  }

  rotateBuilding(id: BuildingId, to: Rotation): Result<void, EngineError> {
    return this.#history.execute(new RotateBuildingCommand({ id, to }));
  }

  removeBuilding(id: BuildingId): Result<void, EngineError> {
    return this.#history.execute(new RemoveBuildingCommand({ id }));
  }

  // --- Wall operations ----------------------------------------------------

  addWall(position: GridVec): Result<WallId, EngineError> {
    const command = new AddWallCommand({ position });
    const result = this.#history.execute(command);
    if (!result.ok) return result;
    return ok(command.wallId as WallId);
  }

  removeWall(id: WallId): Result<void, EngineError> {
    return this.#history.execute(new RemoveWallCommand({ id }));
  }

  // --- Batch operations ---------------------------------------------------

  /**
   * Remove a mixed set of buildings and walls in one atomic, undoable step.
   * Used by the editor's "delete selection", where the selection can hold both
   * kinds. An empty selection is a successful no-op.
   */
  removeEntities(
    buildingIds: readonly BuildingId[],
    wallIds: readonly WallId[],
  ): Result<void, EngineError> {
    return this.#runBatch("Delete selection", [
      ...buildingIds.map((id) => new RemoveBuildingCommand({ id })),
      ...wallIds.map((id) => new RemoveWallCommand({ id })),
    ]);
  }

  /**
   * Move a mixed set of buildings and walls in one atomic, undoable step
   * (drag / arrow-nudge of a selection that can hold both kinds). Either every
   * move applies or none does. An empty set is a successful no-op.
   */
  moveEntities(
    buildingMoves: readonly { id: BuildingId; to: GridVec }[],
    wallMoves: readonly { id: WallId; to: GridVec }[],
  ): Result<void, EngineError> {
    return this.#runBatch("Move selection", [
      ...buildingMoves.map((m) => new MoveBuildingCommand({ id: m.id, to: m.to })),
      ...wallMoves.map((m) => new MoveWallCommand({ id: m.id, to: m.to })),
    ]);
  }

  /** Run a list of commands as a single history entry (macro when >1). */
  #runBatch(label: string, commands: Command[]): Result<void, EngineError> {
    const [first, ...rest] = commands;
    if (!first) return ok(undefined);
    if (rest.length === 0) return this.#history.execute(first);
    return this.#history.execute(new MacroCommand(label, commands));
  }

  // --- History ------------------------------------------------------------

  undo(): boolean {
    return this.#history.undo();
  }

  redo(): boolean {
    return this.#history.redo();
  }

  // --- Persistence --------------------------------------------------------

  toSnapshot(): VillageSnapshot {
    return this.#village.toSnapshot();
  }

  /**
   * Replace the current layout with a loaded one. History is reset (you cannot
   * undo across a load) and a `LayoutLoaded` event opens the new timeline.
   */
  load(snapshot: VillageSnapshot): Result<void, EngineError> {
    const rebuilt = Village.fromSnapshot(snapshot, this.#catalog);
    if (!rebuilt.ok) return rebuilt;
    this.#village = rebuilt.value;
    this.#events = new EventStore();
    this.#history = new CommandStack(this.#context());
    this.#events.append({ type: "LayoutLoaded", snapshot });
    return ok(undefined);
  }

  static createEmpty(options: VillageEditorOptions): VillageEditor {
    return new VillageEditor(options);
  }

  static forGridSize(
    size: number,
    catalog: BuildingCatalog,
    tier = 1,
    ids?: IdGenerator,
  ): VillageEditor {
    const base: VillageEditorOptions = { grid: Grid.square(size), catalog, tier };
    return new VillageEditor(ids ? { ...base, ids } : base);
  }

  #context(): CommandContext {
    return { village: this.#village, events: this.#events, ids: this.#ids };
  }
}
