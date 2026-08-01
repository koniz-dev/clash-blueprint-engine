import type { GridVec, Result } from "@clash/shared";
import { invariant, ok } from "@clash/shared";
import type { BuildingId, BuildingInstance } from "../../domain/building.js";
import type { EngineError } from "../../domain/errors.js";
import type { Rotation } from "../../domain/rotation.js";
import { brand } from "@clash/shared";
import type { Command, CommandContext } from "../command.js";

export interface AddBuildingParams {
  readonly definitionId: string;
  readonly position: GridVec;
  readonly rotation?: Rotation;
}

/** Place a new building. Undo removes it; redo re-places it with the same id. */
export class AddBuildingCommand implements Command {
  readonly label = "Add building";
  readonly #params: AddBuildingParams;
  /** Captured on first execute so redo reuses the identical instance. */
  #instance: BuildingInstance | undefined;

  constructor(params: AddBuildingParams) {
    this.#params = params;
  }

  /** The placed building's id — available after a successful execute. */
  get buildingId(): BuildingId | undefined {
    return this.#instance?.id;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const instance: BuildingInstance = this.#instance ?? {
      id: brand<"Building">(ctx.ids.next()),
      definitionId: this.#params.definitionId,
      position: this.#params.position,
      rotation: this.#params.rotation ?? 0,
    };

    const placed = ctx.village.placeBuilding(instance);
    if (!placed.ok) return placed;

    this.#instance = instance;
    ctx.events.append({ type: "BuildingPlaced", building: instance });
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#instance, "Cannot undo AddBuildingCommand before execute");
    const removed = ctx.village.removeBuilding(this.#instance.id);
    invariant(removed.ok, "Undo of AddBuildingCommand failed — inconsistent history");
    ctx.events.append({ type: "BuildingDeleted", building: removed.value });
  }
}
