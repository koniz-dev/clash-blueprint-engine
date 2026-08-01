import { categoryColor } from "@clash/renderer";
import { useI18n } from "./i18n";
import type { EditorController } from "./useEditor";

export function Inspector({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const building = controller.selectedBuilding;
  const sceneBuilding = building
    ? controller.scene.buildings.find((b) => b.id === building.id)
    : undefined;

  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.inspector")}</h2>
      {controller.selectedIds.length > 1 ? (
        <div className="cbe-inspector">
          <p>{controller.selectedIds.length} buildings selected.</p>
          <div className="cbe-inspector-actions">
            <button className="cbe-btn" onClick={controller.actions.copySelection}>
              Copy
            </button>
            <button className="cbe-btn cbe-btn-danger" onClick={controller.actions.deleteSelected}>
              Delete all
            </button>
          </div>
        </div>
      ) : !building ? (
        <p className="cbe-muted">
          Select a building to inspect it. Shift-click to multi-select; ⌘/Ctrl+C / V to copy &amp;
          paste.
        </p>
      ) : (
        <div className="cbe-inspector">
          <div className="cbe-kv">
            <span>Name</span>
            <b>{sceneBuilding?.name ?? building.definitionId}</b>
          </div>
          <div className="cbe-kv">
            <span>Position</span>
            <b>
              {building.position.x}, {building.position.y}
            </b>
          </div>
          <div className="cbe-kv">
            <span>Rotation</span>
            <b>{building.rotation}°</b>
          </div>
          <div className="cbe-inspector-actions">
            <button className="cbe-btn" onClick={controller.actions.rotateSelected}>
              Rotate
            </button>
            <button className="cbe-btn" onClick={controller.actions.copySelection}>
              Copy
            </button>
            <button className="cbe-btn cbe-btn-danger" onClick={controller.actions.deleteSelected}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatsPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const { scene } = controller;
  const byCategory = new Map<string, number>();
  for (const b of scene.buildings)
    byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + 1);
  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.stats")}</h2>
      <div className="cbe-kv">
        <span>Buildings</span>
        <b>{scene.buildings.length}</b>
      </div>
      <div className="cbe-kv">
        <span>Walls</span>
        <b>{scene.walls.length}</b>
      </div>
      <div className="cbe-kv">
        <span>{scene.tierLabel}</span>
        <b>{scene.tier}</b>
      </div>
      <div className="cbe-chiprow">
        {[...byCategory.entries()].map(([cat, n]) => (
          <span key={cat} className="cbe-chip" style={{ borderColor: categoryColor(cat) }}>
            {cat}: {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ValidationPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const report = controller.validation;
  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.validation")}</h2>
      {!report ? (
        <p className="cbe-muted">Run “Validate” to check the layout.</p>
      ) : report.issues.length === 0 ? (
        <p className="cbe-ok">No issues — layout is valid.</p>
      ) : (
        <ul className="cbe-issues">
          {report.issues.map((issue, i) => (
            <li key={i} className={`cbe-issue cbe-sev-${issue.severity}`}>
              <span className="cbe-sev-badge">{issue.severity}</span>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalysisPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const score = controller.analysis;
  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.analysis")}</h2>
      {!score ? (
        <p className="cbe-muted">Run “Analyze” for a defensive breakdown.</p>
      ) : (
        <div>
          <div className="cbe-score">
            <span className={`cbe-grade cbe-grade-${score.grade}`}>{score.grade}</span>
            <span className="cbe-score-num">
              {score.overall}
              <small>/100</small>
            </span>
          </div>
          <div className="cbe-metrics">
            {score.metrics.map((m) => (
              <div key={m.metricId} className="cbe-metric">
                <span>{m.label}</span>
                <div className="cbe-bar">
                  <div className="cbe-bar-fill" style={{ width: `${m.score}%` }} />
                </div>
                <b>{m.score}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AiPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const report = controller.ai;
  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.ai")}</h2>
      {controller.aiLoading ? (
        <p className="cbe-muted">Analyzing (simulating attacks)…</p>
      ) : !report ? (
        <p className="cbe-muted">Run “AI Suggest” for ranked improvements.</p>
      ) : report.recommendations.length === 0 ? (
        <p className="cbe-ok">No improvements found — solid base!</p>
      ) : (
        <ul className="cbe-recs">
          {report.recommendations.map((rec) => {
            const action = rec.action;
            return (
              <li key={rec.id} className={`cbe-rec cbe-prio-${rec.priority}`}>
                <div className="cbe-rec-head">
                  <span className="cbe-prio-badge">{rec.priority}</span>
                  <b>{rec.title}</b>
                </div>
                <p>{rec.detail}</p>
                <small className="cbe-muted">{rec.rationale}</small>
                {action?.type === "move" && (
                  <button
                    className="cbe-btn cbe-btn-small"
                    onClick={() => controller.actions.applyMove(action.buildingId, action.to)}
                  >
                    Apply move
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function EventLogPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="cbe-log">
      <h2 className="cbe-panel-title">{t("panel.log")}</h2>
      <ul className="cbe-log-list">
        {controller.log.map((entry) => (
          <li key={entry.id} className={`cbe-log-item cbe-log-${entry.kind}`}>
            <span className="cbe-log-kind">{entry.kind}</span>
            {entry.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
