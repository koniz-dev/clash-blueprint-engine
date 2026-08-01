import { useCallback, useRef } from "react";
import { brand, type GridVec } from "@clash/shared";
import type { Rotation, VillageEditor } from "@clash/engine";
import type { PushLog } from "./useLog";

interface ClipboardItem {
  definitionId: string;
  position: GridVec;
  rotation: Rotation;
}

/**
 * Copy / paste of the selected buildings. The clipboard is a ref (no re-render
 * on copy); paste replays `addBuilding` at an offset and re-selects the result.
 */
export function useClipboard(
  editor: VillageEditor,
  selectedIds: string[],
  setSelectedIds: (ids: string[]) => void,
  pushLog: PushLog,
): { copySelection: () => void; paste: () => void } {
  const clipboard = useRef<ClipboardItem[]>([]);

  const copySelection = useCallback(() => {
    clipboard.current = selectedIds.flatMap((id) => {
      const b = editor.village.getBuilding(brand<"Building">(id));
      return b
        ? [{ definitionId: b.definitionId, position: b.position, rotation: b.rotation }]
        : [];
    });
    if (clipboard.current.length > 0) {
      pushLog("info", `Copied ${clipboard.current.length} building(s)`);
    }
  }, [editor, selectedIds, pushLog]);

  const paste = useCallback(() => {
    const OFFSET = 2;
    const pastedIds: string[] = [];
    for (const item of clipboard.current) {
      const target = { x: item.position.x + OFFSET, y: item.position.y + OFFSET };
      const result = editor.addBuilding(item.definitionId, target, item.rotation);
      if (result.ok) pastedIds.push(result.value);
    }
    if (pastedIds.length > 0) {
      setSelectedIds(pastedIds);
      pushLog("info", `Pasted ${pastedIds.length} building(s)`);
    }
  }, [editor, setSelectedIds, pushLog]);

  return { copySelection, paste };
}
