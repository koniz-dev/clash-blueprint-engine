import type { GridVec, Result } from "@clash/shared";
import { err, invariant, ok } from "@clash/shared";
import type { EngineError } from "../../domain/errors.js";
import type { WallId } from "../../domain/wall.js";
import type { Command, CommandContext } from "../command.js";

export interface MoveWallParams {
  readonly id: WallId;
  readonly to: GridVec;
}

/** Move a wall to a new tile, preserving its id. Fully reversible. */
export class MoveWallCommand implements Command {
  readonly label = "Move wall";
  readonly #params: MoveWallParams;
  #from: GridVec | undefined;

  constructor(params: MoveWallParams) {
    this.#params = params;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const current = ctx.village.getWall(this.#params.id);
    if (!current) return err({ kind: "NOT_FOUND", id: this.#params.id });

    const from = this.#from ?? current.position;
    const moved = ctx.village.moveWall(this.#params.id, this.#params.to);
    if (!moved.ok) return moved;

    this.#from = from;
    ctx.events.append({ type: "WallMoved", id: this.#params.id, from, to: this.#params.to });
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    invariant(this.#from, "Cannot undo MoveWallCommand before execute");
    const reverted = ctx.village.moveWall(this.#params.id, this.#from);
    invariant(reverted.ok, "Undo of MoveWallCommand failed — inconsistent history");
    ctx.events.append({
      type: "WallMoved",
      id: this.#params.id,
      from: this.#params.to,
      to: this.#from,
    });
  }
}
