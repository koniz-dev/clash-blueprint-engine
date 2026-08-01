import type { Result } from "@clash/shared";
import { TypedEventEmitter } from "@clash/shared";
import type { EngineError } from "../domain/errors.js";
import type { Command, CommandContext } from "./command.js";

interface CommandStackEvents extends Record<string, unknown> {
  changed: { canUndo: boolean; canRedo: boolean };
}

/**
 * Undo/redo history over {@link Command}s. Executing a command pushes it onto
 * the undo stack and clears the redo stack (standard editor semantics — a new
 * action after undo forks history). A command whose `execute` fails is not
 * recorded, so history only ever contains successfully applied changes.
 */
export class CommandStack {
  readonly #ctx: CommandContext;
  readonly #undo: Command[] = [];
  readonly #redo: Command[] = [];
  readonly #emitter = new TypedEventEmitter<CommandStackEvents>();

  constructor(ctx: CommandContext) {
    this.#ctx = ctx;
  }

  execute(command: Command): Result<void, EngineError> {
    const result = command.execute(this.#ctx);
    if (result.ok) {
      this.#undo.push(command);
      this.#redo.length = 0;
      this.#notify();
    }
    return result;
  }

  undo(): boolean {
    const command = this.#undo.pop();
    if (!command) return false;
    command.undo(this.#ctx);
    this.#redo.push(command);
    this.#notify();
    return true;
  }

  redo(): boolean {
    const command = this.#redo.pop();
    if (!command) return false;
    // Re-executing a captured command is deterministic (ids were fixed on the
    // first run). A redo of previously valid history cannot fail.
    command.execute(this.#ctx);
    this.#undo.push(command);
    this.#notify();
    return true;
  }

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.#undo.at(-1)?.label;
  }

  get redoLabel(): string | undefined {
    return this.#redo.at(-1)?.label;
  }

  clear(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
    this.#notify();
  }

  onChanged(listener: (state: { canUndo: boolean; canRedo: boolean }) => void): () => void {
    return this.#emitter.on("changed", listener);
  }

  #notify(): void {
    this.#emitter.emit("changed", { canUndo: this.canUndo, canRedo: this.canRedo });
  }
}
