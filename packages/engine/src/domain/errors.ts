import type { GridVec, Rect } from "@clash/shared";

/**
 * Recoverable domain failures returned via `Result` (never thrown). Every
 * mutation on the {@link ./village.ts} aggregate reports conflicts through
 * one of these so callers — commands, UI, importers — handle them explicitly.
 */
export type EngineError =
  | { readonly kind: "UNKNOWN_DEFINITION"; readonly definitionId: string }
  | { readonly kind: "OUT_OF_BOUNDS"; readonly bounds: Rect }
  | { readonly kind: "OVERLAP"; readonly cells: ReadonlyArray<GridVec> }
  | { readonly kind: "NOT_FOUND"; readonly id: string }
  | { readonly kind: "DUPLICATE_ID"; readonly id: string };

export function describeEngineError(error: EngineError): string {
  switch (error.kind) {
    case "UNKNOWN_DEFINITION":
      return `No building definition registered for "${error.definitionId}"`;
    case "OUT_OF_BOUNDS":
      return `Placement falls outside the grid (bounds ${error.bounds.x},${error.bounds.y} ${error.bounds.width}×${error.bounds.height})`;
    case "OVERLAP":
      return `Placement overlaps ${error.cells.length} occupied tile(s)`;
    case "NOT_FOUND":
      return `No object with id "${error.id}"`;
    case "DUPLICATE_ID":
      return `An object with id "${error.id}" already exists`;
  }
}
