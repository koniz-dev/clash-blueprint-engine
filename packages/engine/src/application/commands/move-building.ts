import type { GridVec, Result } from "@clash/shared";
import { err, invariant, ok } from "@clash/shared";
import type { BuildingId } from "../../domain/building.js";
import type { EngineError } from "../../domain/errors.js";
import type { Command, CommandContext } from "../command.js";

export interface MoveBuildingParams {
  readonly id: BuildingId;
  readonly to: GridVec;
}

/** Move a building to a new tile, preserving rotation. Fully reversible. */
export class MoveBuildingCommand implements Command {
  readonly label = "Move building";
  readonly #params: MoveBuildingParams;
  #from: GridVec | undefined;

  constructor(params: MoveBuildingParams) {
    this.#params = params;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const current = ctx.village.getBuilding(this.#params.id);
    if (!current) return err({ kind: "NOT_FOUND", id: this.#params.id });

    const from = this.#from ?? current.position;
    const moved = ctx.village.transformBuilding(this.#params.id, this.#params.to, current.rotation);
    if (!moved.ok) return moved;

    this.#from = from;
    ctx.events.append({ type: "BuildingMoved", id: this.#params.id, from, to: this.#params.to });
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#from, "Cannot undo MoveBuildingCommand before execute");
    const current = ctx.village.getBuilding(this.#params.id);
    invariant(current, "Building vanished before undo — inconsistent history");
    const reverted = ctx.village.transformBuilding(this.#params.id, this.#from, current.rotation);
    invariant(reverted.ok, "Undo of MoveBuildingCommand failed — inconsistent history");
    ctx.events.append({
      type: "BuildingMoved",
      id: this.#params.id,
      from: this.#params.to,
      to: this.#from,
    });
  }
}
