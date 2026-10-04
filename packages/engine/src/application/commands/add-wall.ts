import type { GridVec, Result } from "@clash/shared";
import { brand, err, invariant, ok } from "@clash/shared";
import type { EngineError } from "../../domain/errors.js";
import type { WallId, WallSegment } from "../../domain/wall.js";
import type { Command, CommandContext } from "../command.js";

export interface AddWallParams {
  readonly position: GridVec;
}

/** Place a single wall piece. Undo removes it; redo restores the same id. */
export class AddWallCommand implements Command {
  readonly label = "Add wall";
  readonly #params: AddWallParams;
  #segment: WallSegment | undefined;

  constructor(params: AddWallParams) {
    this.#params = params;
  }

  get wallId(): WallId | undefined {
    return this.#segment?.id;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    if (this.#segment) {
      const added = ctx.village.addWall(this.#segment);
      if (!added.ok) return added;
      ctx.events.append({ type: "WallAdded", wall: this.#segment });
      return ok(undefined);
    }

    let lastId = "";
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      lastId = ctx.ids.next();
      if (ctx.village.hasEntityId(lastId)) continue;
      const segment: WallSegment = {
        id: brand<"Wall">(lastId),
        position: this.#params.position,
      };
      const added = ctx.village.addWall(segment);
      if (!added.ok) return added;
      this.#segment = segment;
      ctx.events.append({ type: "WallAdded", wall: segment });
      return ok(undefined);
    }
    return err({ kind: "DUPLICATE_ID", id: lastId });
  }

  undo(ctx: CommandContext): void {
    invariant(this.#segment, "Cannot undo AddWallCommand before execute");
    const removed = ctx.village.removeWall(this.#segment.id);
    invariant(removed.ok, "Undo of AddWallCommand failed — inconsistent history");
    ctx.events.append({ type: "WallRemoved", wall: removed.value });
  }
}
