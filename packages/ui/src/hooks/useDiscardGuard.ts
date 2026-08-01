import { useCallback, useState } from "react";
import type { VillageEditor } from "@clash/engine";
import type { MessageKey, MessageParams } from "../i18n";

export interface ConfirmPrompt {
  /** The prompt text as a message key + params, translated at render time. */
  messageKey: MessageKey;
  params?: MessageParams;
  onConfirm: () => void;
}

/**
 * Guards actions that discard the current layout (New / Open / Import). When the
 * layout is non-empty it stages a confirmation prompt; otherwise the action runs
 * immediately. The `ConfirmDialog` renders `confirmPrompt` and calls back. The
 * message is carried as an i18n key so it localizes at render, not at dispatch.
 */
export function useDiscardGuard(editor: VillageEditor) {
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPrompt | null>(null);

  const guardDiscard = useCallback(
    (messageKey: MessageKey, action: () => void, params?: MessageParams) => {
      if (editor.village.buildingCount === 0 && editor.village.wallCount === 0) {
        action();
      } else {
        setConfirmPrompt({ messageKey, params, onConfirm: action });
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
