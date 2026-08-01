// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VillageEditor } from "@clash/engine";
import { serializeLayout } from "@clash/plugins";
import { storyCatalog } from "../story-fixtures";
import { usePersistence } from "./usePersistence";

const KEY = "game:layout";

function newEditor() {
  return VillageEditor.forGridSize(20, storyCatalog, 1);
}

beforeEach(() => window.localStorage.clear());

describe("usePersistence — restore", () => {
  it("restores a versioned saved layout on mount", () => {
    const seed = newEditor();
    seed.addBuilding("cannon", { x: 2, y: 2 });
    window.localStorage.setItem(KEY, serializeLayout(seed.toSnapshot()));

    const editor = newEditor();
    const afterLoad = vi.fn();
    const pushLog = vi.fn();
    renderHook(() => usePersistence({ editor, persistKey: KEY, version: 0, afterLoad, pushLog }));

    expect(editor.village.buildingCount).toBe(1);
    expect(afterLoad).toHaveBeenCalled();
    expect(pushLog).toHaveBeenCalledWith("info", "Restored your last session");
  });

  it("migrates a legacy unversioned payload (townHall → tier) on restore", () => {
    const legacy = {
      grid: { width: 20, height: 20 },
      townHall: 5,
      buildings: [{ id: "b1", definitionId: "cannon", position: { x: 2, y: 2 }, rotation: 0 }],
      walls: [],
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const editor = newEditor();
    renderHook(() =>
      usePersistence({ editor, persistKey: KEY, version: 0, afterLoad: vi.fn(), pushLog: vi.fn() }),
    );
    expect(editor.village.buildingCount).toBe(1);
    expect(editor.village.tier).toBe(5);
  });

  it("does not restore an empty saved layout", () => {
    const empty = newEditor();
    window.localStorage.setItem(KEY, serializeLayout(empty.toSnapshot()));
    const afterLoad = vi.fn();
    renderHook(() =>
      usePersistence({
        editor: newEditor(),
        persistKey: KEY,
        version: 0,
        afterLoad,
        pushLog: vi.fn(),
      }),
    );
    expect(afterLoad).not.toHaveBeenCalled();
  });
});

describe("usePersistence — autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces a versioned autosave after a change", () => {
    const editor = newEditor();
    editor.addBuilding("cannon", { x: 5, y: 5 });

    const { rerender } = renderHook(
      ({ version }) =>
        usePersistence({ editor, persistKey: KEY, version, afterLoad: vi.fn(), pushLog: vi.fn() }),
      { initialProps: { version: 0 } },
    );

    act(() => rerender({ version: 1 }));
    // Nothing written yet (debounced).
    expect(window.localStorage.getItem(KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(400));

    const stored = window.localStorage.getItem(KEY);
    expect(stored).toContain('"formatVersion"');
    expect(stored).toContain('"buildings"');
  });

  it("does nothing without a persistKey", () => {
    const editor = newEditor();
    editor.addBuilding("cannon", { x: 5, y: 5 });
    const afterLoad = vi.fn();
    renderHook(() =>
      usePersistence({ editor, persistKey: undefined, version: 1, afterLoad, pushLog: vi.fn() }),
    );
    act(() => vi.advanceTimersByTime(400));
    expect(window.localStorage.length).toBe(0);
    expect(afterLoad).not.toHaveBeenCalled();
  });
});
