// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VillageEditor } from "@clash/engine";
import { storyCatalog } from "../story-fixtures";
import { useClipboard } from "./useClipboard";

describe("useClipboard", () => {
  it("copies then pastes at an offset with new ids and re-selects the paste", () => {
    const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
    // A 1×1 building so the +2 paste offset lands clear of the original.
    const added = editor.addBuilding("bomb", { x: 2, y: 2 });
    const originalId = added.ok ? added.value : "";
    const setSelectedIds = vi.fn();
    const pushLog = vi.fn();

    const { result } = renderHook(() =>
      useClipboard(editor, [originalId], setSelectedIds, pushLog),
    );

    act(() => result.current.copySelection());
    expect(pushLog).toHaveBeenCalledWith("info", "Copied 1 building(s)");

    act(() => result.current.paste());

    // A second building now exists, offset by +2, with a fresh id.
    expect(editor.village.buildingCount).toBe(2);
    expect(editor.village.occupantAt({ x: 4, y: 4 })).toBeDefined();
    const pastedIds = setSelectedIds.mock.calls.at(-1)?.[0] as string[];
    expect(pastedIds).toHaveLength(1);
    expect(pastedIds[0]).not.toBe(originalId);
    expect(pushLog).toHaveBeenCalledWith("info", "Pasted 1 building(s)");
  });

  it("pasting an empty clipboard is a no-op", () => {
    const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
    const setSelectedIds = vi.fn();
    const pushLog = vi.fn();
    const { result } = renderHook(() => useClipboard(editor, [], setSelectedIds, pushLog));

    act(() => result.current.paste());
    expect(editor.village.buildingCount).toBe(0);
    expect(setSelectedIds).not.toHaveBeenCalled();
  });
});
