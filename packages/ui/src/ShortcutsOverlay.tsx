import { useEffect, useRef } from "react";
import { useI18n, type MessageKey } from "./i18n";
import { formatCombo, type Gesture, type Shortcut, type ShortcutGroup } from "./shortcuts";

const GROUP_ORDER: ShortcutGroup[] = ["Edit", "Selection", "Tools", "View"];
const GROUP_KEY: Record<ShortcutGroup, MessageKey> = {
  Edit: "group.Edit",
  Selection: "group.Selection",
  Tools: "group.Tools",
  View: "group.View",
};

export interface ShortcutsOverlayProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly shortcuts: readonly Shortcut[];
  readonly gestures: readonly Gesture[];
  /** ⌘ vs Ctrl display. Defaults to the current platform. */
  readonly isMac?: boolean;
}

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

/** Selector for the focusable elements we trap Tab within. */
const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

/**
 * A right-side "sheet" listing keyboard shortcuts (grouped) and mouse gestures.
 * Pure presentation: it renders the shortcut metadata it's given and calls
 * `onClose` — it imports no engine/domain code. Accessible: `role="dialog"`,
 * `aria-modal`, focus-trapped, Esc to close, focus restored on close.
 */
export function ShortcutsOverlay({
  open,
  onClose,
  shortcuts,
  gestures,
  isMac = detectMac(),
}: ShortcutsOverlayProps): JSX.Element | null {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus management: move focus in on open, restore it on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => previouslyFocused.current?.focus();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Trap Tab within the panel.
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: shortcuts.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="cbe-overlay-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="cbe-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cbe-overlay-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cbe-overlay-head">
          <h2 id="cbe-overlay-title" className="cbe-panel-title">
            {t("help.title")}
          </h2>
          <button
            className="cbe-btn cbe-btn-small"
            onClick={onClose}
            aria-label={t("help.closeAria")}
          >
            {t("help.close")} ✕
          </button>
        </div>

        <div className="cbe-overlay-body">
          {groups.map(({ group, items }) => (
            <section key={group} className="cbe-overlay-group" aria-label={t(GROUP_KEY[group])}>
              <h3 className="cbe-overlay-group-title">{t(GROUP_KEY[group])}</h3>
              {items.map((s) => (
                <div key={s.id} className="cbe-overlay-row">
                  <span>{t(s.label)}</span>
                  <span className="cbe-keys">
                    {s.keys.map((combo, i) => (
                      <kbd key={i} className="cbe-kbd">
                        {formatCombo(combo, isMac)}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}

          <section className="cbe-overlay-group" aria-label={t("help.mouse")}>
            <h3 className="cbe-overlay-group-title">{t("help.mouse")}</h3>
            {gestures.map((g) => (
              <div key={g.label} className="cbe-overlay-row">
                <span>{t(g.hint)}</span>
                <span className="cbe-keys">
                  <kbd className="cbe-kbd">{t(g.label)}</kbd>
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
