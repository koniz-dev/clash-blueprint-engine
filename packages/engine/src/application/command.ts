import type { IdGenerator, Result } from "@clash/shared";
import type { EngineError } from "../domain/errors.js";
import type { Village } from "../domain/village.js";
import type { EventStore } from "./event-store.js";

/** Everything a command needs to act, injected so commands stay pure of I/O. */
export interface CommandContext {
  readonly village: Village;
  readonly events: EventStore;
  readonly ids: IdGenerator;
}

/**
 * A reversible user action (the Command pattern). `execute` performs the change
 * and records forward event(s); `undo` performs the exact inverse and records
 * the inverse event(s). Redo is simply `execute` again — commands capture any
 * generated identity on first run so re-execution is deterministic.
 *
 * This single abstraction powers undo, redo, history, replay and the future
 * collaboration layer.
 */
export interface Command {
  /** Human-readable label for history UIs ("Add Cannon", "Move building"). */
  readonly label: string;
  execute(ctx: CommandContext): Result<void, EngineError>;
  undo(ctx: CommandContext): void;
}
