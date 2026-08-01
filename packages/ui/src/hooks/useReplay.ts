import { useCallback, useEffect, useState } from "react";
import type { BuildingCatalog, GameRules, VillageEditor } from "@clash/engine";
import { type GridVec } from "@clash/shared";
import {
  DEFAULT_TROOPS,
  replayDuration,
  simulateAttack,
  type Deployment,
  type SimulationResult,
} from "@clash/simulation";
import type { PushLog } from "./useLog";

/**
 * Attack replay: run the deterministic simulation (in `@clash/simulation`) and
 * animate its returned timeline. This is a *view* over sim output — it stores
 * playback state and a `requestAnimationFrame` clock, and never mutates the
 * village. Deployment markers are collected here, then handed to `simulateAttack`.
 */
export function useReplay(
  editor: VillageEditor,
  catalog: BuildingCatalog,
  rules: GameRules,
  pushLog: PushLog,
) {
  const [replay, setReplay] = useState<SimulationResult | null>(null);
  const [replayTime, setReplayTime] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [deployMode, setDeployMode] = useState(false);
  const [deployTroopId, setDeployTroopId] = useState<string>(DEFAULT_TROOPS[0]?.id ?? "barbarian");
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  const addDeployAt = useCallback(
    (position: GridVec) => {
      setDeployments((prev) => [...prev, { troopId: deployTroopId, position }]);
    },
    [deployTroopId],
  );

  const clearDeployments = useCallback(() => setDeployments([]), []);

  const runReplay = useCallback(() => {
    if (deployments.length === 0) {
      pushLog("info", "Add attacking troops first (Deploy), then Play");
      return;
    }
    const result = simulateAttack(editor.village, catalog, deployments, { rules });
    setReplay(result);
    setReplayTime(0);
    setReplayPlaying(true);
    setDeployMode(false);
    pushLog(
      "info",
      `Attack: ${result.stars}★ · ${result.destructionPercent}% in ${result.durationSeconds.toFixed(1)}s`,
    );
  }, [editor, catalog, deployments, rules, pushLog]);

  const exitReplay = useCallback(() => {
    setReplay(null);
    setReplayPlaying(false);
    setReplayTime(0);
  }, []);

  const toggleReplayPlaying = useCallback(() => {
    if (!replay) return;
    setReplayPlaying((playing) => {
      // Restart from the beginning if we're paused at the very end.
      if (!playing && replayTime >= replayDuration(replay.timeline)) setReplayTime(0);
      return !playing;
    });
  }, [replay, replayTime]);

  const seekReplay = useCallback((time: number) => {
    setReplayPlaying(false);
    setReplayTime(time);
  }, []);

  // Playback clock: advance replayTime by wall-clock × speed while playing.
  const duration = replay ? replayDuration(replay.timeline) : 0;
  useEffect(() => {
    if (!replay || !replayPlaying) return;
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number): void => {
      if (last !== null) {
        const dt = ((now - last) / 1000) * replaySpeed;
        setReplayTime((t) => {
          const next = t + dt;
          if (next >= duration) {
            setReplayPlaying(false);
            return duration;
          }
          return next;
        });
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [replay, replayPlaying, replaySpeed, duration]);

  return {
    replay,
    replayTime,
    replayDuration: duration,
    replayPlaying,
    replaySpeed,
    deployMode,
    deployTroopId,
    deployments,
    troopRoster: DEFAULT_TROOPS.map((t) => ({ id: t.id, name: t.name })),
    setDeployMode,
    setDeployTroopId,
    addDeployAt,
    clearDeployments,
    runReplay,
    exitReplay,
    toggleReplayPlaying,
    seekReplay,
    setReplaySpeed,
  };
}
