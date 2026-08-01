/**
 * Thrown when a programmer invariant is violated. This represents a bug, not a
 * recoverable domain error — recoverable failures use `Result` instead.
 */
export class InvariantError extends Error {
  override readonly name = "InvariantError";
}

/**
 * Assert a condition that must hold. Narrows the type of `condition` for the
 * TypeScript compiler when it survives the call.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

/** Exhaustiveness helper for discriminated-union switch statements. */
export function assertNever(value: never, message = "Unexpected value"): never {
  throw new InvariantError(`${message}: ${JSON.stringify(value)}`);
}
