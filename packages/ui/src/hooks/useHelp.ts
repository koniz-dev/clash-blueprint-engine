import { useCallback, useEffect, useState } from "react";

/**
 * The in-UI help overlay's open state plus the dismissible first-run hint,
 * remembered in `localStorage` under a per-game key (reusing the autosave-key
 * convention). Opening or toggling help also dismisses the hint.
 */
export function useHelp(persistKey?: string) {
  const helpHintKey = `${persistKey ?? "cbe"}:help-hint`;
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(true);

  const dismissHelpHint = useCallback(() => {
    setHintDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem(helpHintKey, "1");
  }, [helpHintKey]);
  const openHelp = useCallback(() => {
    setHelpOpen(true);
    dismissHelpHint();
  }, [dismissHelpHint]);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const toggleHelp = useCallback(() => {
    setHelpOpen((open) => !open);
    dismissHelpHint();
  }, [dismissHelpHint]);

  // Show the first-run hint once, unless previously dismissed (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintDismissed(window.localStorage.getItem(helpHintKey) === "1");
  }, [helpHintKey]);

  return { helpOpen, hintDismissed, openHelp, closeHelp, toggleHelp, dismissHelpHint };
}
