// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useHelp } from "./useHelp";

describe("useHelp", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the hint on first run and dismisses it when help opens", () => {
    const { result } = renderHook(() => useHelp("game"));
    // The mount effect read localStorage: no key ⇒ not dismissed.
    expect(result.current.hintDismissed).toBe(false);

    act(() => result.current.openHelp());
    expect(result.current.helpOpen).toBe(true);
    expect(result.current.hintDismissed).toBe(true);
    expect(window.localStorage.getItem("game:help-hint")).toBe("1");
  });

  it("toggles and closes the overlay", () => {
    const { result } = renderHook(() => useHelp("game"));
    act(() => result.current.toggleHelp());
    expect(result.current.helpOpen).toBe(true);
    act(() => result.current.closeHelp());
    expect(result.current.helpOpen).toBe(false);
  });

  it("treats a previously-dismissed hint as dismissed", () => {
    window.localStorage.setItem("game:help-hint", "1");
    const { result } = renderHook(() => useHelp("game"));
    expect(result.current.hintDismissed).toBe(true);
  });
});
