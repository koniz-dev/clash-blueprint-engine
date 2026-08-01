// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VillageEditor } from "@clash/engine";
import { buildScene } from "@clash/renderer";
import { storyCatalog } from "../story-fixtures";
import { useSelection } from "./useSelection";

function setup() {
  const editor = VillageEditor.forGridSize(20, storyCatalog, 1);
  editor.addBuilding("cannon", { x: 2, y: 2 }); // 3×3 covers (2,2)–(4,4)
  editor.addWall({ x: 10, y: 10 });
  const scene = buildScene(editor.village, storyCatalog, { tierLabel: "TH" });
  return { editor, scene };
}

describe("useSelection", () => {
  it("selects a building and a wall by tile", () => {
    const { editor, scene } = setup();
    const { result } = renderHook(() => useSelection(editor, scene));

    act(() => result.current.selectAt({ x: 3, y: 3 }));
    expect(result.current.selectedIds).toHaveLength(1);
    expect(result.current.partitionSelection().buildingIds).toHaveLength(1);
    expect(result.current.partitionSelection().wallIds).toHaveLength(0);

    act(() => result.current.selectAt({ x: 10, y: 10 }));
    expect(result.current.partitionSelection().wallIds).toHaveLength(1);
  });

  it("additive click toggles membership", () => {
    const { editor, scene } = setup();
    const { result } = renderHook(() => useSelection(editor, scene));

    act(() => result.current.selectAt({ x: 3, y: 3 }));
    act(() => result.current.selectAt({ x: 10, y: 10 }, true)); // add the wall
    expect(result.current.selectedIds).toHaveLength(2);

    act(() => result.current.selectAt({ x: 10, y: 10 }, true)); // toggle wall off
    expect(result.current.selectedIds).toHaveLength(1);
  });

  it("marquee selects buildings and walls intersecting the rect", () => {
    const { editor, scene } = setup();
    const { result } = renderHook(() => useSelection(editor, scene));

    act(() => result.current.selectInRect({ x: 0, y: 0, width: 20, height: 20 }));
    const { buildingIds, wallIds } = result.current.partitionSelection();
    expect(buildingIds).toHaveLength(1);
    expect(wallIds).toHaveLength(1);
  });

  it("clears the selection and empty-space click deselects", () => {
    const { editor, scene } = setup();
    const { result } = renderHook(() => useSelection(editor, scene));

    act(() => result.current.selectAt({ x: 3, y: 3 }));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);

    act(() => result.current.selectAt({ x: 3, y: 3 }));
    act(() => result.current.selectAt({ x: 0, y: 0 })); // empty tile, non-additive
    expect(result.current.selectedIds).toEqual([]);
  });
});
