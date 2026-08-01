// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShortcutContext } from "../shortcuts";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function makeCtx(): ShortcutContext {
  return {
    selectionCount: 1,
    undo: vi.fn(),
    redo: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    deleteSelection: vi.fn(),
    nudge: vi.fn(),
    setTool: vi.fn(),
    rotate: vi.fn(),
    toggleHelp: vi.fn(),
  };
}

function press(init: KeyboardEventInit, target?: EventTarget): void {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => void (target ?? window).dispatchEvent(event));
}

describe("useKeyboardShortcuts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("dispatches registry actions from key events", () => {
    const ctx = makeCtx();
    renderHook(() => useKeyboardShortcuts(ctx));

    press({ key: "w" });
    expect(ctx.setTool).toHaveBeenCalledWith("wall");
    press({ key: "v" });
    expect(ctx.setTool).toHaveBeenCalledWith("select");
    press({ key: "r" });
    expect(ctx.rotate).toHaveBeenCalledTimes(1);

    press({ key: "z", ctrlKey: true });
    expect(ctx.undo).toHaveBeenCalledTimes(1);
    press({ key: "z", ctrlKey: true, shiftKey: true });
    expect(ctx.redo).toHaveBeenCalledTimes(1);
    press({ key: "c", ctrlKey: true });
    expect(ctx.copy).toHaveBeenCalledTimes(1);
    press({ key: "v", ctrlKey: true });
    expect(ctx.paste).toHaveBeenCalledTimes(1);

    press({ key: "Delete" });
    expect(ctx.deleteSelection).toHaveBeenCalledTimes(1);
    press({ key: "ArrowUp" });
    expect(ctx.nudge).toHaveBeenCalledWith(0, -1);
    press({ key: "/", shiftKey: true });
    expect(ctx.toggleHelp).toHaveBeenCalledTimes(1);
  });

  it("respects `when` guards (no delete without a selection)", () => {
    const ctx = { ...makeCtx(), selectionCount: 0 };
    renderHook(() => useKeyboardShortcuts(ctx));
    press({ key: "Delete" });
    expect(ctx.deleteSelection).not.toHaveBeenCalled();
  });

  it("ignores keys while a text input is focused", () => {
    const ctx = makeCtx();
    renderHook(() => useKeyboardShortcuts(ctx));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    press({ key: "w" }, input);
    expect(ctx.setTool).not.toHaveBeenCalled();
    input.remove();
  });
});
