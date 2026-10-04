import type { GridVec, Result } from "@clash/shared";
import { err, invariant, ok } from "@clash/shared";
import type { BuildingId } from "../../domain/building.js";
import type { EngineError } from "../../domain/errors.js";
import type { Rotation } from "../../domain/rotation.js";
import type { WallId } from "../../domain/wall.js";
import type { Command, CommandContext } from "../command.js";

interface BuildingTransform {
  readonly id: BuildingId;
  readonly position: GridVec;
  readonly rotation: Rotation;
}

interface WallTransform {
  readonly id: WallId;
  readonly position: GridVec;
}

/** Move a mixed selection against its final occupancy as one atomic command. */
export class MoveEntitiesCommand implements Command {
  readonly label: string;
  readonly #buildingsTo: readonly { readonly id: BuildingId; readonly to: GridVec }[];
  readonly #wallsTo: readonly { readonly id: WallId; readonly to: GridVec }[];
  #buildingsFrom: BuildingTransform[] | undefined;
  #wallsFrom: WallTransform[] | undefined;

  constructor(
    label: string,
    buildings: readonly { readonly id: BuildingId; readonly to: GridVec }[],
    walls: readonly { readonly id: WallId; readonly to: GridVec }[],
  ) {
    this.label = label;
    this.#buildingsTo = buildings;
    this.#wallsTo = walls;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const buildingsFrom: BuildingTransform[] = [];
    for (const move of this.#buildingsTo) {
      const current = ctx.village.getBuilding(move.id);
      if (!current) return err({ kind: "NOT_FOUND", id: move.id });
      buildingsFrom.push({ id: move.id, position: current.position, rotation: current.rotation });
    }
    const wallsFrom: WallTransform[] = [];
    for (const move of this.#wallsTo) {
      const current = ctx.village.getWall(move.id);
      if (!current) return err({ kind: "NOT_FOUND", id: move.id });
      wallsFrom.push({ id: move.id, position: current.position });
    }

    const buildingsTo: BuildingTransform[] = this.#buildingsTo.map((move, index) => ({
      id: move.id,
      position: move.to,
      rotation: buildingsFrom[index]!.rotation,
    }));
    const wallsTo: WallTransform[] = this.#wallsTo.map((move) => ({
      id: move.id,
      position: move.to,
    }));
    const moved = ctx.village.transformEntities(buildingsTo, wallsTo);
    if (!moved.ok) return moved;

    this.#buildingsFrom ??= buildingsFrom;
    this.#wallsFrom ??= wallsFrom;
    for (let i = 0; i < buildingsTo.length; i += 1) {
      const from = this.#buildingsFrom[i]!;
      const to = buildingsTo[i]!;
      ctx.events.append({ type: "BuildingMoved", id: to.id, from: from.position, to: to.position });
    }
    for (let i = 0; i < wallsTo.length; i += 1) {
      const from = this.#wallsFrom[i]!;
      const to = wallsTo[i]!;
      ctx.events.append({ type: "WallMoved", id: to.id, from: from.position, to: to.position });
    }
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#buildingsFrom && this.#wallsFrom, "Cannot undo move before execute");
    const reverted = ctx.village.transformEntities(this.#buildingsFrom, this.#wallsFrom);
    invariant(reverted.ok, "Undo of MoveEntitiesCommand failed — inconsistent history");

    for (let i = 0; i < this.#buildingsTo.length; i += 1) {
      const from = this.#buildingsTo[i]!;
      const to = this.#buildingsFrom[i]!;
      ctx.events.append({ type: "BuildingMoved", id: to.id, from: from.to, to: to.position });
    }
    for (let i = 0; i < this.#wallsTo.length; i += 1) {
      const from = this.#wallsTo[i]!;
      const to = this.#wallsFrom[i]!;
      ctx.events.append({ type: "WallMoved", id: to.id, from: from.to, to: to.position });
    }
  }
}
