import { categoryColor } from "@clash/renderer";
import { categoryMessageKey, directionMessageKey, useI18n } from "./i18n";
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
          <p>{t("inspector.multiSelected", { count: controller.selectedIds.length })}</p>
          <div className="cbe-inspector-actions">
            <button className="cbe-btn" onClick={controller.actions.copySelection}>
              {t("action.copy")}
            </button>
            <button className="cbe-btn cbe-btn-danger" onClick={controller.actions.deleteSelected}>
              {t("action.deleteAll")}
            </button>
          </div>
        </div>
      ) : !building ? (
        <p className="cbe-muted">{t("inspector.empty")}</p>
      ) : (
        <div className="cbe-inspector">
          <div className="cbe-kv">
            <span>{t("inspector.name")}</span>
            <b>{sceneBuilding?.name ?? building.definitionId}</b>
          </div>
          <div className="cbe-kv">
            <span>{t("inspector.position")}</span>
            <b>
              {building.position.x}, {building.position.y}
            </b>
          </div>
          <div className="cbe-kv">
            <span>{t("inspector.rotation")}</span>
            <b>{building.rotation}°</b>
          </div>
          <div className="cbe-inspector-actions">
            <button className="cbe-btn" onClick={controller.actions.rotateSelected}>
              {t("action.rotate")}
            </button>
            <button className="cbe-btn" onClick={controller.actions.copySelection}>
              {t("action.copy")}
            </button>
            <button className="cbe-btn cbe-btn-danger" onClick={controller.actions.deleteSelected}>
              {t("action.delete")}
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
        <span>{t("stats.buildings")}</span>
        <b>{scene.buildings.length}</b>
      </div>
      <div className="cbe-kv">
        <span>{t("stats.walls")}</span>
        <b>{scene.walls.length}</b>
      </div>
      <div className="cbe-kv">
        <span>{scene.tierLabel}</span>
        <b>{scene.tier}</b>
      </div>
      <div className="cbe-chiprow">
        {[...byCategory.entries()].map(([cat, n]) => {
          const key = categoryMessageKey(cat);
          return (
            <span key={cat} className="cbe-chip" style={{ borderColor: categoryColor(cat) }}>
              {key ? t(key) : cat}: {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ValidationPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  // Live: derived from the pure validator on every change (no "Validate" needed).
  const report = controller.liveValidation.report;
  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.validation")}</h2>
      {!report ? (
        <p className="cbe-muted">{t("validation.noRuleSet")}</p>
      ) : report.issues.length === 0 ? (
        <p className="cbe-ok">{t("validation.ok")}</p>
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
  // Live: derived from the pure analyzer on every change (no "Analyze" needed).
  const score = controller.liveAnalysis.score;
  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.analysis")}</h2>
      {!score ? (
        <p className="cbe-muted">{t("analysis.empty")}</p>
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
          {score.weakPoints.length > 0 && (
            <div className="cbe-weakpoints">
              <div className="cbe-weak-title">{t("analysis.weakPoints")}</div>
              <ul className="cbe-issues">
                {score.weakPoints.map((wp, i) => {
                  const areaKey = wp.area ? directionMessageKey(wp.area) : null;
                  return (
                    <li key={i} className={`cbe-issue cbe-weak-${wp.severity}`}>
                      <span className="cbe-sev-badge">{wp.severity}</span>
                      {wp.message}
                      {areaKey && <span className="cbe-weak-area">{t(areaKey)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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
        <p className="cbe-muted">{t("ai.loading")}</p>
      ) : !report ? (
        <p className="cbe-muted">{t("ai.empty")}</p>
      ) : report.recommendations.length === 0 ? (
        <p className="cbe-ok">{t("ai.none")}</p>
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
                    {t("ai.applyMove")}
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
