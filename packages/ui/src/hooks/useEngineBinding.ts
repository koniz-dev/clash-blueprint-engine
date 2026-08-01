import { useCallback, useEffect, useState } from "react";
import type { StoredEvent, VillageEditor } from "@clash/engine";
import type { PushLog } from "./useLog";

/**
 * Bridges the engine's mutation streams into React. Subscribes to the
 * `CommandStack` and `EventStore` so any domain change bumps a `version`
 * counter (which downstream memos key on) and appends to the log. `rebind`
 * re-subscribes after `editor.load` swaps in fresh store instances.
 */
export function useEngineBinding(
  editor: VillageEditor,
  pushLog: PushLog,
): { version: number; bump: () => void; rebind: () => void } {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const [subEpoch, setSubEpoch] = useState(0);
  const rebind = useCallback(() => setSubEpoch((e) => e + 1), []);

  useEffect(() => {
    const offHistory = editor.history.onChanged(() => bump());
    const offEvents = editor.events.onAppended((stored: StoredEvent) => {
      pushLog("event", stored.event.type);
      bump();
    });
    return () => {
      offHistory();
      offEvents();
    };
  }, [editor, pushLog, bump, subEpoch]);

  return { version, bump, rebind };
}
