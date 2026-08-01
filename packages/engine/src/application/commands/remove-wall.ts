import type { Result } from "@clash/shared";
import { invariant, ok } from "@clash/shared";
import type { EngineError } from "../../domain/errors.js";
import type { WallId, WallSegment } from "../../domain/wall.js";
import type { Command, CommandContext } from "../command.js";

export interface RemoveWallParams {
  readonly id: WallId;
}

/** Remove a wall piece. Undo restores it exactly. */
export class RemoveWallCommand implements Command {
  readonly label = "Remove wall";
  readonly #params: RemoveWallParams;
  #removed: WallSegment | undefined;

  constructor(params: RemoveWallParams) {
    this.#params = params;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const removed = ctx.village.removeWall(this.#params.id);
    if (!removed.ok) return removed;
    this.#removed = removed.value;
    ctx.events.append({ type: "WallRemoved", wall: removed.value });
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#removed, "Cannot undo RemoveWallCommand before execute");
    const restored = ctx.village.addWall(this.#removed);
    invariant(restored.ok, "Undo of RemoveWallCommand failed — inconsistent history");
    ctx.events.append({ type: "WallAdded", wall: this.#removed });
  }
}
