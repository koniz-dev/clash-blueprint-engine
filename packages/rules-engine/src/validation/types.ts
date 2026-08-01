import type { BuildingCatalog, Village } from "@clash/engine";
import type { RuleSet } from "../rule-set.js";

export type Severity = "error" | "warning" | "suggestion";

/**
 * A single validation finding. `code` is a stable machine key for UI/tests;
 * `message` is human-facing; `subjects` lists the entity ids it concerns so the
 * editor can highlight them.
 */
export interface ValidationIssue {
  readonly ruleId: string;
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
  readonly subjects?: ReadonlyArray<string>;
}

/** Everything a rule needs. Read-only — rules never mutate the layout. */
export interface ValidationContext {
  readonly village: Village;
  readonly ruleSet: RuleSet;
  readonly catalog: BuildingCatalog;
  /** Per-game label for the progression axis (e.g. "Town Hall"). */
  readonly tierLabel: string;
}

/**
 * A validation rule (composition over inheritance): the engine holds a list of
 * these and runs each. Adding a rule is registering an object, not subclassing.
 */
export interface ValidationRule {
  readonly id: string;
  validate(context: ValidationContext): ValidationIssue[];
}
