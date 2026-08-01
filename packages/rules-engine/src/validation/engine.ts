import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type EventStore,
  type GameRules,
  type Village,
} from "@clash/engine";
import type { RuleSet } from "../rule-set.js";
import { ValidationReport } from "./report.js";
import { createDefaultRules } from "./rules.js";
import type { ValidationContext, ValidationRule } from "./types.js";

/**
 * Runs a list of {@link ValidationRule}s over a village and aggregates their
 * findings. Rules are injected (defaulting to {@link createDefaultRules}), so
 * consumers can add, remove or reorder checks — including plugin-supplied ones
 * in a later phase — without changing this class.
 */
export class ValidationEngine {
  readonly #rules: ReadonlyArray<ValidationRule>;

  constructor(rules: ReadonlyArray<ValidationRule> = createDefaultRules()) {
    this.#rules = rules;
  }

  validate(
    village: Village,
    ruleSet: RuleSet,
    catalog: BuildingCatalog,
    rules: GameRules = DEFAULT_GAME_RULES,
  ): ValidationReport {
    const context: ValidationContext = { village, ruleSet, catalog, tierLabel: rules.tierLabel };
    const issues = this.#rules.flatMap((rule) => rule.validate(context));
    return new ValidationReport(issues);
  }

  /**
   * Validate and record a `LayoutValidated` event on the timeline. Keeps the
   * detailed report in this package while the engine's event log stays
   * decoupled (it only stores severity counts).
   */
  validateAndRecord(
    village: Village,
    ruleSet: RuleSet,
    catalog: BuildingCatalog,
    events: EventStore,
    rules: GameRules = DEFAULT_GAME_RULES,
  ): ValidationReport {
    const report = this.validate(village, ruleSet, catalog, rules);
    events.append({ type: "LayoutValidated", ...report.summary() });
    return report;
  }
}
