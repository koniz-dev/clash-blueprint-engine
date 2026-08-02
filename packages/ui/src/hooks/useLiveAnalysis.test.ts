// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GAME_RULES, VillageEditor } from "@clash/engine";
import { storyCatalog } from "../story-fixtures";
import { deriveLiveAnalysis, useLiveAnalysis } from "./useLiveAnalysis";

function editorWith(defs: Array<[string, number, number]>) {
  const editor = VillageEditor.forGridSize(44, storyCatalog, 8);
  for (const [def, x, y] of defs) editor.addBuilding(def, { x, y });
  return editor;
}

const GRADES = ["S", "A", "B", "C", "D", "F"];

describe("deriveLiveAnalysis", () => {
  it("returns an empty view for an empty village (nothing to grade)", () => {
    const editor = VillageEditor.forGridSize(44, storyCatalog, 8);
    const live = deriveLiveAnalysis(editor.village, storyCatalog, DEFAULT_GAME_RULES);
    expect(live.score).toBeNull();
    expect(live.weakById.size).toBe(0);
    expect(live.byArea.size).toBe(0);
  });

  it("scores a non-empty base and grades it", () => {
    // Core in the middle, a storage exposed in a far corner, minimal defense.
    const editor = editorWith([
      ["town_hall", 20, 20],
      ["gold_storage", 2, 2],
      ["cannon", 22, 22],
    ]);
    const live = deriveLiveAnalysis(editor.village, storyCatalog, DEFAULT_GAME_RULES);

    expect(live.score).not.toBeNull();
    expect(live.score!.overall).toBeGreaterThanOrEqual(0);
    expect(live.score!.overall).toBeLessThanOrEqual(100);
    expect(GRADES).toContain(live.score!.grade);
  });

  it("maps weak-point subjects to real building ids with valid severities", () => {
    const editor = editorWith([
      ["town_hall", 20, 20],
      ["gold_storage", 1, 1],
      ["elixir_storage", 41, 41],
    ]);
    const ids = new Set<string>(editor.village.listBuildings().map((b) => b.id));
    const live = deriveLiveAnalysis(editor.village, storyCatalog, DEFAULT_GAME_RULES);

    // A sparse base with exposed storages should surface at least one weak cue.
    expect(live.weakById.size + live.byArea.size).toBeGreaterThan(0);
    for (const [id, severity] of live.weakById) {
      expect(ids.has(id)).toBe(true);
      expect(["critical", "weak"]).toContain(severity);
    }
    for (const severity of live.byArea.values()) {
      expect(["critical", "weak"]).toContain(severity);
    }
  });
});

describe("useLiveAnalysis (debounced reactivity)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("recomputes after the 200ms debounce when the version changes", () => {
    const editor = VillageEditor.forGridSize(44, storyCatalog, 8);
    const { result, rerender } = renderHook(
      ({ version }) => useLiveAnalysis(editor, storyCatalog, DEFAULT_GAME_RULES, version),
      { initialProps: { version: 0 } },
    );

    // Lazy initial compute: empty village ⇒ no score.
    expect(result.current.score).toBeNull();

    editor.addBuilding("town_hall", { x: 20, y: 20 });
    act(() => rerender({ version: 1 }));
    // Debounced — not yet updated.
    expect(result.current.score).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.score).not.toBeNull();
  });
});
