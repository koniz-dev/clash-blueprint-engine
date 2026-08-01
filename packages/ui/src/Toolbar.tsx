import { OpenMenu } from "./OpenMenu";
import { shortcutHint } from "./shortcuts";
import type { EditorController, Tool } from "./useEditor";
import { downloadDataUrl, downloadExport } from "./util";

const TOOLS: ReadonlyArray<{ id: Tool; label: string; hint: string; shortcutId: string }> = [
  { id: "select", label: "Select", hint: "Select & inspect buildings", shortcutId: "tool-select" },
  { id: "place", label: "Place", hint: "Place the chosen building", shortcutId: "tool-place" },
  { id: "wall", label: "Wall", hint: "Paint walls (drag)", shortcutId: "tool-wall" },
  { id: "delete", label: "Delete", hint: "Remove buildings & walls", shortcutId: "tool-delete" },
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
  const isMac = detectMac();
  return (
    <div className="cbe-toolbar">
      <div className="cbe-toolbar-group">
        <button className="cbe-btn" onClick={actions.reset}>
          New
        </button>
        <OpenMenu controller={controller} />
        <button
          className="cbe-btn"
          onClick={actions.undo}
          disabled={!canUndo}
          title={withHotkey("Undo", "undo", isMac)}
        >
          Undo
        </button>
        <button
          className="cbe-btn"
          onClick={actions.redo}
          disabled={!canRedo}
          title={withHotkey("Redo", "redo", isMac)}
        >
          Redo
        </button>
      </div>

      <div className="cbe-toolbar-group">
        <button
          title="2D editing view"
          className={`cbe-btn ${viewMode === "2d" ? "cbe-btn-active" : ""}`}
          onClick={() => setViewMode("2d")}
        >
          2D
        </button>
        <button
          title="3D visualization view"
          className={`cbe-btn ${viewMode === "3d" ? "cbe-btn-active" : ""}`}
          onClick={() => setViewMode("3d")}
        >
          3D
        </button>
      </div>

      <div className="cbe-toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={withHotkey(t.hint, t.shortcutId, isMac)}
            className={`cbe-btn ${tool === t.id ? "cbe-btn-active" : ""}`}
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
            disabled={viewMode === "3d"}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="cbe-toolbar-group">
        <button className="cbe-btn" onClick={actions.runValidation}>
          Validate
        </button>
        <button className="cbe-btn" onClick={actions.runAnalysis}>
          Analyze
        </button>
        <button
          className="cbe-btn cbe-btn-accent"
          onClick={() => void actions.runAi()}
          disabled={controller.aiLoading}
        >
          {controller.aiLoading ? "Analyzing…" : "AI Suggest"}
        </button>
      </div>

      <div className="cbe-toolbar-group">
        <button className="cbe-btn" onClick={() => downloadExport(actions.exportJson())}>
          Export JSON
        </button>
        <button className="cbe-btn" onClick={() => downloadExport(actions.exportAscii())}>
          Export ASCII
        </button>
        <button
          className="cbe-btn"
          title="Retina PNG (2×)"
          onClick={() => {
            void actions.exportPng().then(downloadDataUrl);
          }}
        >
          Export PNG
        </button>
        <button
          className="cbe-btn"
          title="3D model (glTF 2.0)"
          onClick={() => downloadExport(actions.exportGltf())}
        >
          Export glTF
        </button>
      </div>

      <div className="cbe-toolbar-group cbe-toolbar-help">
        <div className="cbe-help-anchor">
          <button
            className="cbe-btn"
            aria-label="Help"
            aria-haspopup="dialog"
            aria-expanded={controller.helpOpen}
            title={withHotkey("Keyboard shortcuts & help", "help", isMac)}
            onClick={actions.toggleHelp}
          >
            ? Help
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
