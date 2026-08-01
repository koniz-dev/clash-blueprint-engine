import { useRef, useState } from "react";
import { useI18n } from "./i18n";
import type { EditorController } from "./useEditor";

/**
 * The toolbar's "Open" control: a dropdown listing bundled template layouts and
 * an "Import JSON…" file picker. It only dispatches controller actions
 * (`loadTemplate`, `importJson`) — the parsing/loading lives in the engine and
 * `useEditor`, never here.
 */
export function OpenMenu({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const { templates, actions } = controller;
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires a change event.
    e.target.value = "";
    if (!file) return;
    void file.text().then((text) => actions.importJson(text, file.name));
    setOpen(false);
  };

  return (
    <div className="cbe-menu">
      <button
        className={`cbe-btn ${open ? "cbe-btn-active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("open.button")} ▾
      </button>
      {open && (
        <>
          {/* Click-away backdrop. */}
          <div className="cbe-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="cbe-menu-panel" role="menu">
            {templates.length > 0 && <div className="cbe-menu-section">{t("open.templates")}</div>}
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                className="cbe-menu-item"
                role="menuitem"
                onClick={() => {
                  actions.loadTemplate(tpl.id);
                  setOpen(false);
                }}
              >
                {tpl.name}
              </button>
            ))}
            <div className="cbe-menu-section">{t("open.file")}</div>
            <button
              className="cbe-menu-item"
              role="menuitem"
              onClick={() => fileRef.current?.click()}
            >
              {t("open.import")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onFile}
              style={{ display: "none" }}
              data-testid="import-json-input"
            />
          </div>
        </>
      )}
    </div>
  );
}
