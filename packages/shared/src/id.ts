/**
 * Nominal (branded) id helper. `EntityId<'Building'>` and `EntityId<'Wall'>`
 * are incompatible even though both are strings, which prevents accidentally
 * passing a wall id where a building id is expected.
 */
export type EntityId<Brand extends string> = string & { readonly __brand: Brand };

export function brand<Brand extends string>(value: string): EntityId<Brand> {
  return value as EntityId<Brand>;
}

/**
 * Source of new ids. Injected rather than imported so the domain stays
 * deterministic and testable — production wires a UUID generator, tests wire a
 * counter. The engine never calls `Math.random`/`crypto` directly.
 */
export interface IdGenerator {
  next(): string;
}

/** Deterministic, monotonic generator. Ideal for tests and replay. */
export function createSequentialIdGenerator(prefix = "id"): IdGenerator {
  let counter = 0;
  return {
    next: () => `${prefix}_${(++counter).toString(36)}`,
  };
}
