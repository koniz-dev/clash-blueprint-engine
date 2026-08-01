import { useEffect, useRef } from "react";
import type { VillageEditor } from "@clash/engine";
import { serializeLayout } from "@clash/plugins";
import { jsonImporter } from "@clash/importer";
import type { PushLog } from "./useLog";

export interface UsePersistenceArgs {
  readonly editor: VillageEditor;
  readonly persistKey: string | undefined;
  /** The engine version counter — autosave debounces on each change. */
  readonly version: number;
  /** Re-bind + rebuild after `editor.load` (clears panels, bumps the scene). */
  readonly afterLoad: () => void;
  readonly pushLog: PushLog;
}

/**
 * Autosave to `localStorage` (debounced) and restore-on-mount. Both go through
 * the versioned save-format so old payloads migrate forward on restore. Disabled
 * when no `persistKey` is provided.
 */
export function usePersistence({
  editor,
  persistKey,
  version,
  afterLoad,
  pushLog,
}: UsePersistenceArgs): void {
  const hydrated = useRef(false);

  // Restore the last session once (client-only), before autosave arms.
  useEffect(() => {
    if (hydrated.current) return;
    if (!persistKey || typeof window === "undefined") {
      hydrated.current = true;
      return;
    }
    const saved = window.localStorage.getItem(persistKey);
    if (saved) {
      const parsed = jsonImporter.import(saved, "autosave");
      if (parsed.ok && (parsed.value.buildings.length > 0 || parsed.value.walls.length > 0)) {
        const loaded = editor.load(parsed.value);
        if (loaded.ok) {
          afterLoad();
          pushLog("info", "Restored your last session");
        }
      }
    }
    hydrated.current = true;
  }, [editor, persistKey, afterLoad, pushLog]);

  // Autosave (debounced) after any domain change, once hydrated.
  useEffect(() => {
    if (!persistKey || typeof window === "undefined" || !hydrated.current) return;
    const id = window.setTimeout(() => {
      // Stamp the current save-format version so a future restore can migrate.
      window.localStorage.setItem(persistKey, serializeLayout(editor.toSnapshot()));
    }, 400);
    return () => window.clearTimeout(id);
  }, [editor, persistKey, version]);
}
