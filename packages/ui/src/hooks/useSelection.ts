import { useCallback, useState } from "react";
import type { BuildingId, BuildingInstance, VillageEditor, WallId } from "@clash/engine";
import { brand, rectsIntersect, type GridVec, type Rect } from "@clash/shared";
import type { Scene } from "@clash/plugins";

/**
 * Entity-agnostic selection. Buildings and walls are both selectable, and the
 * selection is exposed as opaque ids plus a `partitionSelection` helper that
 * splits them by kind for the command layer. No mutation happens here — this
 * hook only tracks *what* is selected.
 */
export function useSelection(editor: VillageEditor, scene: Scene) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0]! : null;

  const selectAt = useCallback(
    (position: GridVec, additive = false) => {
      // Buildings and walls are both selectable; the occupant map covers both.
      const occupant = editor.village.occupantAt(position);
      const id =
        occupant &&
        (editor.village.getBuilding(brand<"Building">(occupant)) ||
          editor.village.getWall(brand<"Wall">(occupant)))
          ? occupant
          : null;
      if (!id) {
        if (!additive) setSelectedIds([]);
        return;
      }
      setSelectedIds((prev) =>
        additive
          ? prev.includes(id)
            ? prev.filter((existing) => existing !== id)
            : [...prev, id]
          : [id],
      );
    },
    [editor],
  );

  // Select an entity directly by id (used by the 3D view's mesh clicks).
  const selectBuilding = useCallback((id: string, additive = false) => {
    setSelectedIds((prev) =>
      additive
        ? prev.includes(id)
          ? prev.filter((existing) => existing !== id)
          : [...prev, id]
        : [id],
    );
  }, []);

  const selectInRect = useCallback(
    (rect: Rect, additive = false) => {
      const buildingIds = scene.buildings
        .filter((b) => rectsIntersect(b.bounds, rect))
        .map((b) => b.id);
      const wallIds = scene.walls
        .filter((w) =>
          rectsIntersect({ x: w.position.x, y: w.position.y, width: 1, height: 1 }, rect),
        )
        .map((w) => w.id);
      const ids = [...buildingIds, ...wallIds];
      setSelectedIds((prev) => (additive ? Array.from(new Set([...prev, ...ids])) : ids));
    },
    [scene],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  /** Split the current selection into its building ids and wall ids. */
  const partitionSelection = useCallback(() => {
    const buildingIds: BuildingId[] = [];
    const wallIds: WallId[] = [];
    for (const id of selectedIds) {
      if (editor.village.getBuilding(brand<"Building">(id)))
        buildingIds.push(brand<"Building">(id));
      else if (editor.village.getWall(brand<"Wall">(id))) wallIds.push(brand<"Wall">(id));
    }
    return { buildingIds, wallIds };
  }, [editor, selectedIds]);

  const selectedBuilding: BuildingInstance | undefined = selectedId
    ? editor.village.getBuilding(brand<"Building">(selectedId))
    : undefined;

  return {
    selectedIds,
    setSelectedIds,
    selectedId,
    selectedBuilding,
    selectAt,
    selectBuilding,
    selectInRect,
    clearSelection,
    partitionSelection,
  };
}

export type Selection = ReturnType<typeof useSelection>;
