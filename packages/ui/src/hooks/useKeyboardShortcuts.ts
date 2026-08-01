import { useEffect, useRef } from "react";
import { resolveShortcut, type ShortcutContext } from "../shortcuts";

/**
 * Global keydown dispatcher. All bindings live in the declarative `SHORTCUTS`
 * registry (the same list the help overlay renders), so this is a thin matcher:
 * skip text inputs, resolve the event to a shortcut, run it. The latest `ctx` is
 * read through a ref, so the listener subscribes exactly once yet always sees
 * current state — no per-render re-subscription, and honest empty deps.
 */
export function useKeyboardShortcuts(ctx: ShortcutContext): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const shortcut = resolveShortcut(e);
      const current = ctxRef.current;
      if (!shortcut || (shortcut.when && !shortcut.when(current))) return;
      if (shortcut.preventDefault) e.preventDefault();
      shortcut.run(current, e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
