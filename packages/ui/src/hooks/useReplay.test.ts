// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GAME_RULES, VillageEditor } from "@clash/engine";
import { storyCatalog } from "../story-fixtures";
import { useReplay } from "./useReplay";

// Stub the animation clock so the playback effect never advances time on its
// own — we assert state transitions, not the rAF loop (that math is covered by
// @clash/simulation's replayStateAt tests).
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

function editorWithBase() {
  const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
  editor.addBuilding("town_hall", { x: 8, y: 8 });
  return editor;
}

describe("useReplay", () => {
  it("collects and clears deployments", () => {
    const { result } = renderHook(() =>
      useReplay(editorWithBase(), storyCatalog, DEFAULT_GAME_RULES, vi.fn()),
    );
    act(() => result.current.addDeployAt({ x: 0, y: 0 }));
    act(() => result.current.addDeployAt({ x: 1, y: 1 }));
    expect(result.current.deployments).toHaveLength(2);
    act(() => result.current.clearDeployments());
    expect(result.current.deployments).toHaveLength(0);
  });

  it("runs a replay, scrubs (pausing), toggles and exits", () => {
    const { result } = renderHook(() =>
      useReplay(editorWithBase(), storyCatalog, DEFAULT_GAME_RULES, vi.fn()),
    );

    act(() => result.current.addDeployAt({ x: 0, y: 0 }));
    act(() => result.current.runReplay());
    expect(result.current.replay).not.toBeNull();
    expect(result.current.replayPlaying).toBe(true);
    expect(result.current.replayDuration).toBeGreaterThan(0);

    // Scrubbing pauses and sets the time.
    act(() => result.current.seekReplay(0.5));
    expect(result.current.replayPlaying).toBe(false);
    expect(result.current.replayTime).toBe(0.5);

    act(() => result.current.toggleReplayPlaying());
    expect(result.current.replayPlaying).toBe(true);

    act(() => result.current.exitReplay());
    expect(result.current.replay).toBeNull();
    expect(result.current.replayTime).toBe(0);
  });

  it("does nothing (logs) when playing with no deployments", () => {
    const pushLog = vi.fn();
    const { result } = renderHook(() =>
      useReplay(editorWithBase(), storyCatalog, DEFAULT_GAME_RULES, pushLog),
    );
    act(() => result.current.runReplay());
    expect(result.current.replay).toBeNull();
    expect(pushLog).toHaveBeenCalledWith("info", expect.stringMatching(/Deploy/));
  });
});
