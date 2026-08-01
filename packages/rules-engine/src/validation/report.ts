import type { Severity, ValidationIssue } from "./types.js";

/** Immutable result of a validation pass, with convenience queries. */
export class ValidationReport {
  readonly issues: ReadonlyArray<ValidationIssue>;

  constructor(issues: ReadonlyArray<ValidationIssue>) {
    this.issues = issues;
  }

  bySeverity(severity: Severity): ReadonlyArray<ValidationIssue> {
    return this.issues.filter((issue) => issue.severity === severity);
  }

  count(severity: Severity): number {
    return this.bySeverity(severity).length;
  }

  get errors(): number {
    return this.count("error");
  }

  get warnings(): number {
    return this.count("warning");
  }

  get suggestions(): number {
    return this.count("suggestion");
  }

  /** A layout is valid when it has no error-severity issues. */
  get isValid(): boolean {
    return this.errors === 0;
  }

  get hasIssues(): boolean {
    return this.issues.length > 0;
  }

  summary(): { errors: number; warnings: number; suggestions: number } {
    return { errors: this.errors, warnings: this.warnings, suggestions: this.suggestions };
  }
}
