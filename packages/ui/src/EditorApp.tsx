import { Suspense, lazy } from "react";
import { BuildingLibrary } from "./BuildingLibrary";
import { EditorCanvas } from "./EditorCanvas";
import {
  AiPanel,
  AnalysisPanel,
  EventLogPanel,
  Inspector,
  StatsPanel,
  ValidationPanel,
} from "./Panels";
import { ConfirmDialog } from "./ConfirmDialog";
import { HistoryPanel } from "./HistoryPanel";
import { I18nProvider, useI18n } from "./i18n";
import { ReplayPanel } from "./ReplayPanel";
import { GESTURES, SHORTCUTS } from "./shortcuts";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Toolbar } from "./Toolbar";
import { useEditor, type UseEditorOptions } from "./useEditor";

// The 3D view pulls in three.js/@react-three; lazy-load it so it lands in its
// own chunk and never bloats the initial (2D) editor bundle.
const EditorScene3D = lazy(() =>
  import("./EditorScene3D").then((m) => ({ default: m.EditorScene3D })),
);

export type EditorAppProps = UseEditorOptions;

/**
 * Top-level editor: toolbar, left building library, the canvas, a right
 * inspector/analysis stack, and a bottom log. It is pure composition over
 * {@link useEditor} — the components read controller state and call controller
 * actions; none of them contain game logic.
 */
export function EditorApp(props: EditorAppProps): JSX.Element {
  // I18nProvider wraps the shell so every component (and the shell's own
  // translated chrome, e.g. the 3D loading fallback and confirm prompt) reads
  // the active locale from context.
  return (
    <I18nProvider>
      <EditorShell {...props} />
    </I18nProvider>
  );
}

function EditorShell(props: EditorAppProps): JSX.Element {
  const { t } = useI18n();
  const controller = useEditor(props);
  return (
    <>
      <div className="cbe-app">
        <header className="cbe-header">
          <div className="cbe-brand">Clash Blueprint Engine</div>
          <Toolbar controller={controller} />
        </header>

        <div className="cbe-body">
          <aside className="cbe-left">
            <BuildingLibrary controller={controller} catalog={props.catalog} />
          </aside>

          <main className="cbe-center">
            {controller.viewMode === "3d" ? (
              <Suspense fallback={<div className="cbe-loading">{t("app.loading3d")}</div>}>
                <EditorScene3D controller={controller} />
              </Suspense>
            ) : (
              <EditorCanvas controller={controller} catalog={props.catalog} />
            )}
          </main>

          <aside className="cbe-right">
            <Inspector controller={controller} />
            <HistoryPanel controller={controller} />
            <ReplayPanel controller={controller} />
            <StatsPanel controller={controller} />
            <ValidationPanel controller={controller} />
            <AnalysisPanel controller={controller} />
            <AiPanel controller={controller} />
          </aside>
        </div>

        <footer className="cbe-footer">
          <EventLogPanel controller={controller} />
        </footer>

        <ShortcutsOverlay
          open={controller.helpOpen}
          onClose={controller.actions.closeHelp}
          shortcuts={SHORTCUTS}
          gestures={GESTURES}
        />

        <ConfirmDialog
          open={controller.confirmPrompt !== null}
          message={
            controller.confirmPrompt
              ? t(controller.confirmPrompt.messageKey, controller.confirmPrompt.params)
              : ""
          }
          onConfirm={controller.actions.confirmDiscard}
          onCancel={controller.actions.cancelConfirm}
        />
      </div>
    </>
  );
}
