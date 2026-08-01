// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VillageEditor } from "@clash/engine";
import { storyCatalog } from "../story-fixtures";
import { useDiscardGuard } from "./useDiscardGuard";

describe("useDiscardGuard", () => {
  it("runs the action immediately when the layout is empty", () => {
    const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
    const { result } = renderHook(() => useDiscardGuard(editor));
    const action = vi.fn();

    act(() => result.current.guardDiscard("discard?", action));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.confirmPrompt).toBeNull();
  });

  it("stages a prompt when the layout is non-empty, then confirms/cancels", () => {
    const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
    editor.addBuilding("cannon", { x: 2, y: 2 });
    const { result } = renderHook(() => useDiscardGuard(editor));
    const action = vi.fn();

    act(() => result.current.guardDiscard("discard?", action));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.confirmPrompt?.message).toBe("discard?");

    // Cancel clears without running.
    act(() => result.current.cancelConfirm());
    expect(result.current.confirmPrompt).toBeNull();
    expect(action).not.toHaveBeenCalled();

    // Re-stage, then confirm runs the action and clears.
    act(() => result.current.guardDiscard("discard?", action));
    act(() => result.current.confirmDiscard());
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.confirmPrompt).toBeNull();
  });
});
