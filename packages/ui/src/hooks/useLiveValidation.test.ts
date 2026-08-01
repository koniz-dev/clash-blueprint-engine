// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GAME_RULES, VillageEditor } from "@clash/engine";
import type { RuleSet } from "@clash/rules-engine";
import { storyCatalog } from "../story-fixtures";
import { deriveLiveValidation, useLiveValidation } from "./useLiveValidation";

function ruleSet(
  tier: number,
  allowances: Record<string, number>,
  required: RuleSet["required"] = [],
): RuleSet {
  return {
    tier,
    gridSize: 44,
    wallLimit: 100,
    allowances: new Map(
      Object.entries(allowances).map(([id, maxCount]) => [id, { definitionId: id, maxCount }]),
    ),
    required,
  };
}

function editorWith(defs: Array<[string, number, number]>) {
  const editor = VillageEditor.forGridSize(44, storyCatalog, 8);
  for (const [def, x, y] of defs) editor.addBuilding(def, { x, y });
  return editor;
}

describe("deriveLiveValidation", () => {
  it("flags an over-limit definition as at-max with error subjects", () => {
    const editor = editorWith([
      ["cannon", 2, 2],
      ["cannon", 6, 2],
      ["cannon", 10, 2],
    ]);
    const live = deriveLiveValidation(
      editor.village,
      storyCatalog,
      ruleSet(8, { cannon: 2 }),
      DEFAULT_GAME_RULES,
    );

    const cannon = live.perDefinition.get("cannon")!;
    expect(cannon).toMatchObject({ count: 3, max: 2, allowed: true, unlocked: true, atMax: true });
    // Every offending cannon id is marked as an inline error.
    const cannonIds = editor.village.listBuildings().map((b) => b.id);
    for (const id of cannonIds) expect(live.severityById.get(id)).toBe("error");
    expect(live.report?.errors).toBeGreaterThan(0);
  });

  it("marks a building above the pack tier as locked + warning", () => {
    // archer_tower has minTier 2; at tier 1 it is not yet unlocked.
    const editor = editorWith([["archer_tower", 5, 5]]);
    const archerId = editor.village.listBuildings()[0]!.id;
    const live = deriveLiveValidation(
      editor.village,
      storyCatalog,
      ruleSet(1, { cannon: 6, archer_tower: 6 }),
      DEFAULT_GAME_RULES,
    );

    expect(live.perDefinition.get("archer_tower")?.unlocked).toBe(false);
    expect(live.severityById.get(archerId)).toBe("warning");
  });

  it("marks a definition the pack doesn't list as not allowed (error)", () => {
    const editor = editorWith([["bomb", 3, 3]]);
    const bombId = editor.village.listBuildings()[0]!.id;
    const live = deriveLiveValidation(
      editor.village,
      storyCatalog,
      ruleSet(8, { cannon: 6 }),
      DEFAULT_GAME_RULES,
    );

    const bomb = live.perDefinition.get("bomb")!;
    expect(bomb.allowed).toBe(false);
    expect(bomb.max).toBeNull();
    expect(live.severityById.get(bombId)).toBe("error");
  });

  it("returns an empty view when there is no rule set", () => {
    const editor = editorWith([["cannon", 2, 2]]);
    const live = deriveLiveValidation(editor.village, storyCatalog, undefined, DEFAULT_GAME_RULES);
    expect(live.report).toBeNull();
    expect(live.severityById.size).toBe(0);
    expect(live.perDefinition.size).toBe(0);
  });
});

describe("useLiveValidation (debounced reactivity)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("recomputes after the debounce when the version changes", () => {
    const editor = VillageEditor.forGridSize(44, storyCatalog, 8);
    const rs = ruleSet(8, { cannon: 6 });
    const { result, rerender } = renderHook(
      ({ version }) => useLiveValidation(editor, storyCatalog, DEFAULT_GAME_RULES, rs, version),
      { initialProps: { version: 0 } },
    );

    // Lazy initial compute: empty village.
    expect(result.current.perDefinition.get("cannon")?.count).toBe(0);

    editor.addBuilding("cannon", { x: 2, y: 2 });
    act(() => rerender({ version: 1 }));
    // Debounced — not yet updated.
    expect(result.current.perDefinition.get("cannon")?.count).toBe(0);
    act(() => vi.advanceTimersByTime(80));
    expect(result.current.perDefinition.get("cannon")?.count).toBe(1);
  });
});
