import type { Result } from "@clash/shared";
import { invariant, ok } from "@clash/shared";
import type { BuildingId, BuildingInstance } from "../../domain/building.js";
import type { EngineError } from "../../domain/errors.js";
import type { Command, CommandContext } from "../command.js";

export interface RemoveBuildingParams {
  readonly id: BuildingId;
}

/** Delete a building. Undo restores it exactly (id, position, rotation). */
export class RemoveBuildingCommand implements Command {
  readonly label = "Delete building";
  readonly #params: RemoveBuildingParams;
  #removed: BuildingInstance | undefined;

  constructor(params: RemoveBuildingParams) {
    this.#params = params;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const removed = ctx.village.removeBuilding(this.#params.id);
    if (!removed.ok) return removed;
    this.#removed = removed.value;
    ctx.events.append({ type: "BuildingDeleted", building: removed.value });
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#removed, "Cannot undo RemoveBuildingCommand before execute");
    const restored = ctx.village.placeBuilding(this.#removed);
    invariant(restored.ok, "Undo of RemoveBuildingCommand failed — inconsistent history");
    ctx.events.append({ type: "BuildingPlaced", building: this.#removed });
  }

  static of(id: BuildingId): RemoveBuildingCommand {
    return new RemoveBuildingCommand({ id });
  }
}
