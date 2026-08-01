import { useI18n } from "./i18n";
import type { EditorController } from "./useEditor";

/**
 * A read-only projection of the engine's command history with click-to-jump.
 * Applied commands are listed oldest→newest (the newest is the current state);
 * undone commands follow, dimmed. Clicking a row issues the right number of
 * undo/redo commands via the facade — the panel holds no history state itself.
 */
export function HistoryPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const { undo, redo } = controller.history;
  const isEmpty = undo.length === 0 && redo.length === 0;

  const rows = [
    ...undo.map((label, j) => ({
      key: `u${j}`,
      label,
      steps: -(undo.length - 1 - j),
      current: j === undo.length - 1,
      future: false,
    })),
    ...redo.map((label, k) => ({
      key: `r${k}`,
      label,
      steps: k + 1,
      current: false,
      future: true,
    })),
  ];

  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.history")}</h2>
      {isEmpty ? (
        <p className="cbe-muted">{t("history.empty")}</p>
      ) : (
        <ol className="cbe-history">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                className={`cbe-history-item ${row.current ? "cbe-history-current" : ""} ${
                  row.future ? "cbe-history-future" : ""
                }`}
                aria-current={row.current ? "step" : undefined}
                disabled={row.current}
                onClick={() => controller.actions.jumpHistory(row.steps)}
              >
                <span className="cbe-history-dot" aria-hidden="true" />
                {row.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
