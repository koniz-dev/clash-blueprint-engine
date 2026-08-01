import type { Result } from "@clash/shared";
import { ok } from "@clash/shared";
import type { EngineError } from "../../domain/errors.js";
import type { Command, CommandContext } from "../command.js";

/**
 * Composes several {@link Command}s into a single, atomic history entry — one
 * undo/redo step for a whole gesture (e.g. dragging a multi-selection, or a
 * batch delete). Sub-commands run in order; if any `execute` fails, the ones
 * that already ran are rolled back (undone in reverse) and the failure is
 * returned, so the aggregate is never left half-applied. `undo` reverses every
 * sub-command; redo re-runs the macro, which is deterministic because each
 * sub-command captured its identity on first execute.
 *
 * An empty macro is a no-op that succeeds — callers can build one from a
 * filtered list without special-casing the empty case.
 */
export class MacroCommand implements Command {
  readonly label: string;
  readonly #commands: readonly Command[];
  /** Sub-commands that have been applied, newest last — the undo order. */
  #applied: Command[] = [];

  constructor(label: string, commands: readonly Command[]) {
    this.label = label;
    this.#commands = commands;
  }

  execute(ctx: CommandContext): Result<void, EngineError> {
    const applied: Command[] = [];
    for (const command of this.#commands) {
      const result = command.execute(ctx);
      if (!result.ok) {
        // Roll back what we already applied so the macro is all-or-nothing.
        rollback(applied, ctx);
        return result;
      }
      applied.push(command);
    }
    this.#applied = applied;
    return ok(undefined);
  }

  undo(ctx: CommandContext): void {
    rollback(this.#applied, ctx);
  }
}

/** Undo `commands` in reverse (newest first). */
function rollback(commands: readonly Command[], ctx: CommandContext): void {
  for (const command of [...commands].reverse()) command.undo(ctx);
}
