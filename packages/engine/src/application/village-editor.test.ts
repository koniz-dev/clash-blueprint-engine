import { describe, expect, it } from "vitest";
import { createTestCatalog, createTestIds } from "../testing/fixtures.js";
import { VillageEditor } from "./village-editor.js";

function makeEditor(): VillageEditor {
  return VillageEditor.forGridSize(44, createTestCatalog(), 8, createTestIds());
}

describe("VillageEditor commands", () => {
  it("adds a building and records a BuildingPlaced event", () => {
    const editor = makeEditor();
    const result = editor.addBuilding("cannon", { x: 10, y: 10 });
    expect(result.ok).toBe(true);
    expect(editor.village.buildingCount).toBe(1);
    expect(editor.events.all().map((e) => e.event.type)).toEqual(["BuildingPlaced"]);
  });

  it("returns an error result on overlap and records nothing", () => {
    const editor = makeEditor();
    editor.addBuilding("cannon", { x: 10, y: 10 });
    const overlap = editor.addBuilding("cannon", { x: 11, y: 11 });
    expect(overlap.ok).toBe(false);
    expect(editor.village.buildingCount).toBe(1);
    // Failed command left no trace in history or the event log.
    expect(editor.history.canUndo).toBe(true); // from the first, successful add
    expect(editor.events.length).toBe(1);
  });
});

describe("VillageEditor undo/redo", () => {
  it("undoes and redoes an add", () => {
    const editor = makeEditor();
    editor.addBuilding("cannon", { x: 10, y: 10 });
    expect(editor.village.buildingCount).toBe(1);

    expect(editor.undo()).toBe(true);
    expect(editor.village.buildingCount).toBe(0);

    expect(editor.redo()).toBe(true);
    expect(editor.village.buildingCount).toBe(1);
  });

  it("redo re-places a building with the same id (deterministic identity)", () => {
    const editor = makeEditor();
    const added = editor.addBuilding("cannon", { x: 10, y: 10 });
    const id = added.ok ? added.value : undefined;
    editor.undo();
    editor.redo();
    expect(editor.village.getBuilding(id!)).toBeDefined();
  });

  it("moving then undoing restores the original position", () => {
    const editor = makeEditor();
    const added = editor.addBuilding("cannon", { x: 10, y: 10 });
    const id = added.ok ? added.value : undefined;
    editor.moveBuilding(id!, { x: 20, y: 20 });
    expect(editor.village.getBuilding(id!)?.position).toEqual({ x: 20, y: 20 });
    editor.undo();
    expect(editor.village.getBuilding(id!)?.position).toEqual({ x: 10, y: 10 });
  });

  it("a new action after undo clears the redo stack", () => {
    const editor = makeEditor();
    editor.addBuilding("cannon", { x: 10, y: 10 });
    editor.undo();
    expect(editor.history.canRedo).toBe(true);
    editor.addBuilding("cannon", { x: 30, y: 30 });
    expect(editor.history.canRedo).toBe(false);
  });

  it("rotating and undoing restores rotation", () => {
    const editor = makeEditor();
    const added = editor.addBuilding("air_defense", { x: 10, y: 10 });
    const id = added.ok ? added.value : undefined;
    editor.rotateBuilding(id!, 90);
    expect(editor.village.getBuilding(id!)?.rotation).toBe(90);
    editor.undo();
    expect(editor.village.getBuilding(id!)?.rotation).toBe(0);
  });
});

describe("VillageEditor event log as a replayable timeline", () => {
  it("records the full sequence of edits in order", () => {
    const editor = makeEditor();
    const added = editor.addBuilding("cannon", { x: 10, y: 10 });
    const id = added.ok ? added.value : undefined;
    editor.moveBuilding(id!, { x: 12, y: 12 });
    editor.addWall({ x: 0, y: 0 });
    editor.undo(); // undo the wall

    expect(editor.events.all().map((e) => e.event.type)).toEqual([
      "BuildingPlaced",
      "BuildingMoved",
      "WallAdded",
      "WallRemoved", // undo appends the inverse fact
    ]);
    // Sequences are monotonic.
    expect(editor.events.all().map((e) => e.sequence)).toEqual([0, 1, 2, 3]);
  });
});

describe("VillageEditor batch operations", () => {
  it("moves several buildings as a single undoable gesture", () => {
    const editor = makeEditor();
    const a = editor.addBuilding("cannon", { x: 10, y: 10 });
    const b = editor.addBuilding("cannon", { x: 20, y: 20 });
    const idA = a.ok ? a.value : undefined;
    const idB = b.ok ? b.value : undefined;

    const moved = editor.moveBuildings([
      { id: idA!, to: { x: 12, y: 12 } },
      { id: idB!, to: { x: 22, y: 22 } },
    ]);
    expect(moved.ok).toBe(true);
    expect(editor.village.getBuilding(idA!)?.position).toEqual({ x: 12, y: 12 });
    expect(editor.village.getBuilding(idB!)?.position).toEqual({ x: 22, y: 22 });

    // One undo reverts the whole gesture.
    editor.undo();
    expect(editor.village.getBuilding(idA!)?.position).toEqual({ x: 10, y: 10 });
    expect(editor.village.getBuilding(idB!)?.position).toEqual({ x: 20, y: 20 });

    // One redo re-applies it deterministically.
    editor.redo();
    expect(editor.village.getBuilding(idA!)?.position).toEqual({ x: 12, y: 12 });
    expect(editor.village.getBuilding(idB!)?.position).toEqual({ x: 22, y: 22 });
  });

  it("rolls back the whole batch when one move fails (atomic)", () => {
    const editor = makeEditor();
    const a = editor.addBuilding("cannon", { x: 10, y: 10 });
    const b = editor.addBuilding("cannon", { x: 20, y: 20 });
    const idA = a.ok ? a.value : undefined;
    const idB = b.ok ? b.value : undefined;

    // A moves to (30,30) first; the second move sends B onto A's *new* tile,
    // so it collides. The batch must abort and roll A back, not half-apply.
    const moved = editor.moveBuildings([
      { id: idA!, to: { x: 30, y: 30 } },
      { id: idB!, to: { x: 30, y: 30 } },
    ]);
    expect(moved.ok).toBe(false);
    expect(editor.village.getBuilding(idA!)?.position).toEqual({ x: 10, y: 10 });
    expect(editor.village.getBuilding(idB!)?.position).toEqual({ x: 20, y: 20 });
    // A rolled-back batch leaves nothing on the undo stack.
    expect(editor.history.undoLabel).toBe("Add building");
  });

  it("deletes a mixed building + wall selection in one undoable step", () => {
    const editor = makeEditor();
    const a = editor.addBuilding("cannon", { x: 10, y: 10 });
    const idA = a.ok ? a.value : undefined;
    editor.addWall({ x: 0, y: 0 });
    const wallId = editor.village.listWalls()[0]?.id;

    const removed = editor.removeEntities([idA!], [wallId!]);
    expect(removed.ok).toBe(true);
    expect(editor.village.buildingCount).toBe(0);
    expect(editor.village.wallCount).toBe(0);

    // A single undo restores both.
    editor.undo();
    expect(editor.village.buildingCount).toBe(1);
    expect(editor.village.wallCount).toBe(1);
  });
});

describe("VillageEditor persistence", () => {
  it("saves and loads a snapshot", () => {
    const editor = makeEditor();
    editor.addBuilding("cannon", { x: 10, y: 10 });
    editor.addWall({ x: 0, y: 0 });
    const snapshot = editor.toSnapshot();

    const fresh = makeEditor();
    const loaded = fresh.load(snapshot);
    expect(loaded.ok).toBe(true);
    expect(fresh.village.buildingCount).toBe(1);
    expect(fresh.village.wallCount).toBe(1);
    expect(fresh.events.all().map((e) => e.event.type)).toEqual(["LayoutLoaded"]);
    // Loading resets history.
    expect(fresh.history.canUndo).toBe(false);
  });
});
