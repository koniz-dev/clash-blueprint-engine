import type { GridVec, Result } from "@clash/shared";
import { err, invariant, ok } from "@clash/shared";
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
    if (this.#instance) {
      const placed = ctx.village.placeBuilding(this.#instance);
      if (!placed.ok) return placed;
      ctx.events.append({ type: "BuildingPlaced", building: this.#instance });
      return ok(undefined);
    }

    // A restored snapshot may already contain ids emitted by a fresh
    // sequential generator. Skip occupied values rather than making the first
    // post-load edit fail with DUPLICATE_ID.
    let lastId = "";
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      lastId = ctx.ids.next();
      if (ctx.village.hasEntityId(lastId)) continue;
      const instance: BuildingInstance = {
        id: brand<"Building">(lastId),
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
    return err({ kind: "DUPLICATE_ID", id: lastId });
  }

  undo(ctx: CommandContext): void {
    invariant(this.#instance, "Cannot undo AddBuildingCommand before execute");
    const removed = ctx.village.removeBuilding(this.#instance.id);
    invariant(removed.ok, "Undo of AddBuildingCommand failed — inconsistent history");
    ctx.events.append({ type: "BuildingDeleted", building: removed.value });
  }
}
