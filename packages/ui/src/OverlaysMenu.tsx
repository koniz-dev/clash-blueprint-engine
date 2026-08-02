import { useState } from "react";
import { useI18n, type MessageKey } from "./i18n";
import type { OverlayKey } from "./hooks/useOverlayPrefs";
import type { EditorController } from "./useEditor";

const ITEMS: ReadonlyArray<{ key: OverlayKey; labelKey: MessageKey }> = [
  { key: "coverage", labelKey: "overlays.coverage" },
  { key: "compartments", labelKey: "overlays.compartments" },
  { key: "deadZones", labelKey: "overlays.deadZones" },
];

/**
 * The toolbar's "Overlays" control: a popover with three checkboxes toggling the
 * defensive canvas overlays. Pure UI — it only flips `overlayPrefs`; the geometry
 * lives in `useOverlays` and the drawing in `EditorCanvas`.
 */
export function OverlaysMenu({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const { prefs, setOverlay, active } = controller.overlayPrefs;
  const [open, setOpen] = useState(false);

  return (
    <div className="cbe-menu">
      <button
        className={`cbe-btn ${open || active ? "cbe-btn-active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("overlays.button")} ▾
      </button>
      {open && (
        <>
          {/* Click-away backdrop. */}
          <div className="cbe-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="cbe-menu-panel" role="menu">
            <div className="cbe-menu-section">{t("overlays.title")}</div>
            {ITEMS.map(({ key, labelKey }) => (
              <label key={key} className="cbe-menu-check">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => setOverlay(key, e.target.checked)}
                />
                {t(labelKey)}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
