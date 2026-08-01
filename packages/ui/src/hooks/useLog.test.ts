// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLog } from "./useLog";

describe("useLog", () => {
  it("prepends entries with monotonic ids", () => {
    const { result } = renderHook(() => useLog());
    act(() => result.current.pushLog("info", "first"));
    act(() => result.current.pushLog("error", "second"));

    expect(result.current.log).toHaveLength(2);
    expect(result.current.log[0]).toMatchObject({ kind: "error", message: "second" });
    expect(result.current.log[1]).toMatchObject({ kind: "info", message: "first" });
    // Ids are unique and increasing.
    expect(result.current.log[0]!.id).toBeGreaterThan(result.current.log[1]!.id);
  });

  it("caps the log at 100 entries", () => {
    const { result } = renderHook(() => useLog());
    act(() => {
      for (let i = 0; i < 150; i += 1) result.current.pushLog("info", `m${i}`);
    });
    expect(result.current.log).toHaveLength(100);
    // Most-recent first.
    expect(result.current.log[0]!.message).toBe("m149");
  });
});
