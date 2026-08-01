// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_GAME_RULES, VillageEditor } from "@clash/engine";
import { storyCatalog, storyRuleSet } from "../story-fixtures";
import { useQueries } from "./useQueries";

function editorWithBase() {
  const editor = VillageEditor.forGridSize(44, storyCatalog, 8);
  editor.addBuilding("town_hall", { x: 20, y: 20 });
  editor.addBuilding("cannon", { x: 10, y: 10 });
  return editor;
}

describe("useQueries", () => {
  it("logs when validation runs without a rule set", () => {
    const pushLog = vi.fn();
    const { result } = renderHook(() =>
      useQueries(editorWithBase(), storyCatalog, DEFAULT_GAME_RULES, undefined, undefined, pushLog),
    );
    act(() => result.current.runValidation());
    expect(pushLog).toHaveBeenCalledWith("info", "No rule set loaded");
    expect(result.current.validation).toBeNull();
  });

  it("runs validation and analysis into panel state", () => {
    const pushLog = vi.fn();
    const { result } = renderHook(() =>
      useQueries(
        editorWithBase(),
        storyCatalog,
        DEFAULT_GAME_RULES,
        storyRuleSet,
        undefined,
        pushLog,
      ),
    );

    act(() => result.current.runValidation());
    expect(result.current.validation).not.toBeNull();

    act(() => result.current.runAnalysis());
    expect(result.current.analysis).not.toBeNull();
    expect(pushLog).toHaveBeenCalledWith("info", expect.stringMatching(/Defense score/));
  });

  it("runs the synchronous AI fallback and resets", async () => {
    const pushLog = vi.fn();
    const { result } = renderHook(() =>
      useQueries(
        editorWithBase(),
        storyCatalog,
        DEFAULT_GAME_RULES,
        storyRuleSet,
        undefined,
        pushLog,
      ),
    );

    await act(async () => {
      await result.current.runAi();
    });
    await waitFor(() => expect(result.current.ai).not.toBeNull());
    expect(result.current.analysis).not.toBeNull();

    act(() => result.current.reset());
    expect(result.current.validation).toBeNull();
    expect(result.current.analysis).toBeNull();
    expect(result.current.ai).toBeNull();
  });

  it("prefers the off-thread analyze runner when provided", async () => {
    const pushLog = vi.fn();
    const report = { recommendations: [], defenseScore: { overall: 50, grade: "C" } };
    const analyzeAsync = vi.fn().mockResolvedValue(report);
    const { result } = renderHook(() =>
      useQueries(
        editorWithBase(),
        storyCatalog,
        DEFAULT_GAME_RULES,
        storyRuleSet,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analyzeAsync as any,
        pushLog,
      ),
    );

    await act(async () => {
      await result.current.runAi();
    });
    expect(analyzeAsync).toHaveBeenCalledTimes(1);
    expect(result.current.ai).toBe(report);
  });
});
