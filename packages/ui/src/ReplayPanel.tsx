import { useI18n } from "./i18n";
import type { EditorController } from "./useEditor";

const SPEEDS = [0.5, 1, 2, 4] as const;

/**
 * Attack-replay controls. Before a run: pick a troop and toggle "Deploy" to
 * drop attackers on the canvas, then Play. During a run: play/pause, scrub, and
 * change speed. It only dispatches controller actions — `simulateAttack` runs
 * in `@clash/simulation` and the timeline animation lives in `useEditor`.
 */
export function ReplayPanel({ controller }: { controller: EditorController }): JSX.Element {
  const { t } = useI18n();
  const { replay, actions } = controller;

  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">{t("panel.replay")}</h2>

      {!replay ? (
        <div className="cbe-replay">
          <p className="cbe-muted">Deploy troops, then play a deterministic attack.</p>

          <div className="cbe-replay-troops">
            {controller.troopRoster.map((t) => (
              <button
                key={t.id}
                className={`cbe-btn cbe-btn-small ${
                  controller.deployTroopId === t.id ? "cbe-btn-active" : ""
                }`}
                onClick={() => {
                  actions.setDeployTroopId(t.id);
                  actions.setDeployMode(true);
                }}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="cbe-replay-row">
            <button
              className={`cbe-btn ${controller.deployMode ? "cbe-btn-active" : ""}`}
              onClick={() => actions.setDeployMode(!controller.deployMode)}
            >
              {controller.deployMode ? "Deploying…" : "Deploy"}
            </button>
            <span className="cbe-muted">{controller.deployments.length} placed</span>
            <button
              className="cbe-btn cbe-btn-small"
              onClick={actions.clearDeployments}
              disabled={controller.deployments.length === 0}
            >
              Clear
            </button>
          </div>

          <button
            className="cbe-btn cbe-btn-accent"
            onClick={actions.runReplay}
            disabled={controller.deployments.length === 0}
          >
            ▶ Play Attack
          </button>
        </div>
      ) : (
        <div className="cbe-replay">
          <div className="cbe-kv">
            <span>Result</span>
            <b>
              {replay.stars}★ · {replay.destructionPercent}%
            </b>
          </div>

          <div className="cbe-replay-row">
            <button className="cbe-btn" onClick={actions.toggleReplayPlaying}>
              {controller.replayPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <span className="cbe-muted">
              {controller.replayTime.toFixed(1)}s / {controller.replayDuration.toFixed(1)}s
            </span>
          </div>

          <input
            className="cbe-replay-scrub"
            type="range"
            min={0}
            max={controller.replayDuration}
            step={0.05}
            value={controller.replayTime}
            onChange={(e) => actions.seekReplay(Number(e.target.value))}
            aria-label="Replay time"
          />

          <div className="cbe-replay-row">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`cbe-btn cbe-btn-small ${
                  controller.replaySpeed === s ? "cbe-btn-active" : ""
                }`}
                onClick={() => actions.setReplaySpeed(s)}
              >
                {s}×
              </button>
            ))}
            <button className="cbe-btn cbe-btn-small" onClick={actions.exitReplay}>
              Exit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
