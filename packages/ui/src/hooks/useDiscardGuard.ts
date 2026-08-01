import { useCallback, useState } from "react";
import type { VillageEditor } from "@clash/engine";

export interface ConfirmPrompt {
  message: string;
  onConfirm: () => void;
}

/**
 * Guards actions that discard the current layout (New / Open / Import). When the
 * layout is non-empty it stages a confirmation prompt; otherwise the action runs
 * immediately. The `ConfirmDialog` renders `confirmPrompt` and calls back.
 */
export function useDiscardGuard(editor: VillageEditor) {
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPrompt | null>(null);

  const guardDiscard = useCallback(
    (message: string, action: () => void) => {
      if (editor.village.buildingCount === 0 && editor.village.wallCount === 0) {
        action();
      } else {
        setConfirmPrompt({ message, onConfirm: action });
      }
    },
    [editor],
  );
  const confirmDiscard = useCallback(() => {
    setConfirmPrompt((prompt) => {
      prompt?.onConfirm();
      return null;
    });
  }, []);
  const cancelConfirm = useCallback(() => setConfirmPrompt(null), []);

  return { confirmPrompt, guardDiscard, confirmDiscard, cancelConfirm };
}
