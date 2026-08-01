import type { Result } from "@clash/shared";
import { err, invariant, ok } from "@clash/shared";
import type { BuildingId } from "../../domain/building.js";
import type { EngineError } from "../../domain/errors.js";
import type { Rotation } from "../../domain/rotation.js";
import type { Command, CommandContext } from "../command.js";

export interface RotateBuildingParams {
  readonly id: BuildingId;
  readonly to: Rotation;
}

/** Rotate a building about its footprint, preserving position. Reversible. */
export class RotateBuildingCommand implements Command {
  readonly label = "Rotate building";
  readonly #params: RotateBuildingParams;
  #from: Rotation | undefined;

  constructor(params: RotateBuildingParams) {
    this.#params = params;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const current = ctx.village.getBuilding(this.#params.id);
    if (!current) return err({ kind: "NOT_FOUND", id: this.#params.id });

    const from = this.#from ?? current.rotation;
    const rotated = ctx.village.transformBuilding(
      this.#params.id,
      current.position,
      this.#params.to,
    );
    if (!rotated.ok) return rotated;

    this.#from = from;
    ctx.events.append({ type: "BuildingRotated", id: this.#params.id, from, to: this.#params.to });
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#from !== undefined, "Cannot undo RotateBuildingCommand before execute");
    const current = ctx.village.getBuilding(this.#params.id);
    invariant(current, "Building vanished before undo — inconsistent history");
    const reverted = ctx.village.transformBuilding(this.#params.id, current.position, this.#from);
    invariant(reverted.ok, "Undo of RotateBuildingCommand failed — inconsistent history");
    ctx.events.append({
      type: "BuildingRotated",
      id: this.#params.id,
      from: this.#params.to,
      to: this.#from,
    });
  }
}
