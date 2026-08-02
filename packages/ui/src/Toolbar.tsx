import { useI18n, type MessageKey } from "./i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { OpenMenu } from "./OpenMenu";
import { shortcutHint } from "./shortcuts";
import type { EditorController, Tool } from "./useEditor";
import { downloadDataUrl, downloadExport } from "./util";

const TOOLS: ReadonlyArray<{
  id: Tool;
  labelKey: MessageKey;
  hintKey: MessageKey;
  shortcutId: string;
}> = [
  { id: "select", labelKey: "tool.select", hintKey: "tool.select.hint", shortcutId: "tool-select" },
  { id: "place", labelKey: "tool.place", hintKey: "tool.place.hint", shortcutId: "tool-place" },
  { id: "wall", labelKey: "tool.wall", hintKey: "tool.wall.hint", shortcutId: "tool-wall" },
  { id: "delete", labelKey: "tool.delete", hintKey: "tool.delete.hint", shortcutId: "tool-delete" },
  { id: "hand", labelKey: "tool.hand", hintKey: "tool.hand.hint", shortcutId: "tool-hand" },
];

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

/** Append a hotkey to a tooltip, e.g. "Undo (⌘Z)". */
function withHotkey(hint: string, shortcutId: string, isMac: boolean): string {
  const keys = shortcutHint(shortcutId, isMac);
  return keys ? `${hint} (${keys})` : hint;
}

export function Toolbar({ controller }: { controller: EditorController }): JSX.Element {
  const { actions, tool, setTool, viewMode, setViewMode, canUndo, canRedo } = controller;
  const { t } = useI18n();
  const isMac = detectMac();
  return (
    <div className="cbe-toolbar">
      <div className="cbe-toolbar-group">
        <button className="cbe-btn" onClick={actions.reset}>
          {t("toolbar.new")}
        </button>
        <OpenMenu controller={controller} />
        <button
          className="cbe-btn"
          onClick={actions.undo}
          disabled={!canUndo}
          title={withHotkey(t("toolbar.undo"), "undo", isMac)}
        >
          {t("toolbar.undo")}
        </button>
        <button
          className="cbe-btn"
          onClick={actions.redo}
          disabled={!canRedo}
          title={withHotkey(t("toolbar.redo"), "redo", isMac)}
        >
          {t("toolbar.redo")}
        </button>
      </div>

      <div className="cbe-toolbar-group">
        <button
          className={`cbe-btn ${viewMode === "2d" ? "cbe-btn-active" : ""}`}
          onClick={() => setViewMode("2d")}
        >
          {t("view.2d")}
        </button>
        <button
          className={`cbe-btn ${viewMode === "3d" ? "cbe-btn-active" : ""}`}
          onClick={() => setViewMode("3d")}
        >
          {t("view.3d")}
        </button>
      </div>

      <div className="cbe-toolbar-group">
        {TOOLS.map((tt) => (
          <button
            key={tt.id}
            title={withHotkey(t(tt.hintKey), tt.shortcutId, isMac)}
            className={`cbe-btn ${tool === tt.id ? "cbe-btn-active" : ""}`}
            aria-pressed={tool === tt.id}
            onClick={() => setTool(tt.id)}
            disabled={viewMode === "3d"}
          >
            {t(tt.labelKey)}
          </button>
        ))}
      </div>

      <div className="cbe-toolbar-group">
        <button
          className="cbe-btn"
          onClick={actions.runValidation}
          title={t("toolbar.validate.hint")}
        >
          {t("toolbar.validate")}
        </button>
        <button
          className="cbe-btn cbe-btn-accent"
          onClick={() => void actions.runAi()}
          disabled={controller.aiLoading}
        >
          {controller.aiLoading ? t("toolbar.aiAnalyzing") : t("toolbar.aiSuggest")}
        </button>
      </div>

      <div className="cbe-toolbar-group">
        <button className="cbe-btn" onClick={() => downloadExport(actions.exportJson())}>
          {t("toolbar.exportJson")}
        </button>
        <button className="cbe-btn" onClick={() => downloadExport(actions.exportAscii())}>
          {t("toolbar.exportAscii")}
        </button>
        <button
          className="cbe-btn"
          title="Retina PNG (2×)"
          onClick={() => {
            void actions.exportPng().then(downloadDataUrl);
          }}
        >
          {t("toolbar.exportPng")}
        </button>
        <button
          className="cbe-btn"
          title="3D model (glTF 2.0)"
          onClick={() => downloadExport(actions.exportGltf())}
        >
          {t("toolbar.exportGltf")}
        </button>
      </div>

      <LanguageSwitcher />

      <div className="cbe-toolbar-group cbe-toolbar-help">
        <div className="cbe-help-anchor">
          <button
            className="cbe-btn"
            aria-label={t("toolbar.help")}
            aria-haspopup="dialog"
            aria-expanded={controller.helpOpen}
            title={withHotkey("Keyboard shortcuts & help", "help", isMac)}
            onClick={actions.toggleHelp}
          >
            ? {t("toolbar.help")}
          </button>
          {!controller.hintDismissed && !controller.helpOpen && (
            <div className="cbe-help-hint" role="note">
              <span>
                New here? See tools &amp; shortcuts in <b>Help</b> (press{" "}
                <kbd className="cbe-kbd">?</kbd>).
              </span>
              <button
                className="cbe-btn cbe-btn-small"
                onClick={actions.dismissHelpHint}
                aria-label="Dismiss hint"
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
