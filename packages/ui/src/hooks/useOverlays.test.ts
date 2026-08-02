// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GAME_RULES, VillageEditor } from "@clash/engine";
import { storyCatalog } from "../story-fixtures";
import { deriveOverlays, useOverlays } from "./useOverlays";

function emptyEditor() {
  return VillageEditor.forGridSize(44, storyCatalog, 8);
}

/** A sealed 4×4 wall box around an empty 2×2 interior (an enclosed dead zone). */
function addWallBox(editor: VillageEditor) {
  for (let x = 5; x <= 8; x += 1) {
    editor.addWall({ x, y: 5 });
    editor.addWall({ x, y: 8 });
  }
  editor.addWall({ x: 5, y: 6 });
  editor.addWall({ x: 5, y: 7 });
  editor.addWall({ x: 8, y: 6 });
  editor.addWall({ x: 8, y: 7 });
}

describe("deriveOverlays", () => {
  it("returns empty geometry for an empty layout", () => {
    const overlays = deriveOverlays(emptyEditor().village, storyCatalog, DEFAULT_GAME_RULES);
    expect(overlays.coverageTiles).toEqual([]);
    expect(overlays.compartments).toEqual([]);
    expect(overlays.deadZoneTiles).toEqual([]);
  });

  it("marks tiles within a defense's range as covered (and far tiles not)", () => {
    const editor = emptyEditor();
    editor.addBuilding("cannon", { x: 20, y: 20 }); // range 9 in the story catalog
    const overlays = deriveOverlays(editor.village, storyCatalog, DEFAULT_GAME_RULES);

    expect(overlays.coverageTiles.length).toBeGreaterThan(0);
    expect(overlays.coverageTiles.some((t) => t.x === 21 && t.y === 21)).toBe(true);
    expect(overlays.coverageTiles.some((t) => t.x === 43 && t.y === 43)).toBe(false);
  });

  it("returns walled compartments and flags enclosed-empty ones as dead zones", () => {
    const editor = emptyEditor();
    addWallBox(editor);
    const overlays = deriveOverlays(editor.village, storyCatalog, DEFAULT_GAME_RULES);

    // The 2×2 interior is one enclosed compartment.
    expect(overlays.compartments.length).toBe(1);
    const box = overlays.compartments[0]!;
    expect(box.color).toMatch(/^#/);
    expect(box.isDeadZone).toBe(true);
    // Its four interior tiles are the dead zone.
    expect(overlays.deadZoneTiles.length).toBe(4);
    expect(overlays.deadZoneTiles.some((t) => t.x === 6 && t.y === 6)).toBe(true);
  });
});

describe("useOverlays (gated + debounced)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does no work while inactive, even as the layout changes", () => {
    const editor = emptyEditor();
    editor.addBuilding("cannon", { x: 20, y: 20 });
    const { result } = renderHook(() =>
      useOverlays(editor, storyCatalog, DEFAULT_GAME_RULES, 1, false),
    );
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.coverageTiles).toEqual([]);
  });

  it("recomputes after the 200ms debounce when active and the version changes", () => {
    const editor = emptyEditor();
    const { result, rerender } = renderHook(
      ({ version }) => useOverlays(editor, storyCatalog, DEFAULT_GAME_RULES, version, true),
      { initialProps: { version: 0 } },
    );

    expect(result.current.coverageTiles).toEqual([]); // lazy init: empty village
    editor.addBuilding("cannon", { x: 20, y: 20 });
    act(() => rerender({ version: 1 }));
    expect(result.current.coverageTiles).toEqual([]); // debounced — not yet
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.coverageTiles.length).toBeGreaterThan(0);
  });
});
