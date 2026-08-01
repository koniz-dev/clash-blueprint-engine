// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VillageEditor } from "@clash/engine";
import { storyCatalog } from "../story-fixtures";
import { useEngineBinding } from "./useEngineBinding";

describe("useEngineBinding", () => {
  it("bumps version on a command and logs appended events", () => {
    const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
    const pushLog = vi.fn();
    const { result } = renderHook(() => useEngineBinding(editor, pushLog));

    expect(result.current.version).toBe(0);

    act(() => {
      editor.addBuilding("cannon", { x: 2, y: 2 });
    });

    // The CommandStack change bumped the version, and the event reached the log.
    expect(result.current.version).toBeGreaterThan(0);
    expect(pushLog).toHaveBeenCalledWith("event", "BuildingPlaced");
  });
});
