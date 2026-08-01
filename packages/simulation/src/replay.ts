import type { SimulationFrame } from "./types.js";

/** A unit's interpolated pose at a replay time. */
export interface ReplayUnit {
  readonly id: string;
  readonly troopId: string;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
}

/** Everything a view needs to draw the battlefield at a single instant. */
export interface ReplayState {
  readonly time: number;
  readonly units: ReadonlyArray<ReplayUnit>;
  readonly destroyedBuildingIds: ReadonlySet<string>;
  readonly brokenWallIds: ReadonlySet<string>;
}

/** Total length of a recorded timeline (0 for an empty one). */
export function replayDuration(timeline: ReadonlyArray<SimulationFrame>): number {
  return timeline.length === 0 ? 0 : (timeline[timeline.length - 1]?.time ?? 0);
}

/**
 * Sample a recorded {@link SimulationFrame} timeline at an arbitrary time `t`,
 * linearly interpolating unit positions between the two bracketing frames so
 * playback is smooth regardless of the record rate. Cumulative destruction
 * (buildings destroyed, walls broken) is derived from every event at or before
 * `t`. Pure and deterministic — the same inputs always yield the same state,
 * which is what lets a worker and the main thread agree frame-for-frame.
 */
export function replayStateAt(timeline: ReadonlyArray<SimulationFrame>, t: number): ReplayState {
  const destroyedBuildingIds = new Set<string>();
  const brokenWallIds = new Set<string>();
  for (const frame of timeline) {
    for (const event of frame.events) {
      if (event.time > t) continue;
      if (event.type === "buildingDestroyed") destroyedBuildingIds.add(event.buildingId);
      else if (event.type === "wallBroken") brokenWallIds.add(event.wallId);
    }
  }

  if (timeline.length === 0) {
    return { time: t, units: [], destroyedBuildingIds, brokenWallIds };
  }

  // Locate the frame at/just-before t (prev) and the next one (for lerp).
  let prev = timeline[0]!;
  let next: SimulationFrame | undefined;
  for (const frame of timeline) {
    if (frame.time <= t) {
      prev = frame;
    } else {
      next = frame;
      break;
    }
  }

  const span = next ? next.time - prev.time : 0;
  const factor = span > 0 ? clamp01((t - prev.time) / span) : 0;
  const nextById = new Map((next?.units ?? []).map((u) => [u.id, u]));

  const units = prev.units.map((u) => {
    const to = nextById.get(u.id);
    if (!to || factor === 0) return { id: u.id, troopId: u.troopId, x: u.x, y: u.y, hp: u.hp };
    return {
      id: u.id,
      troopId: u.troopId,
      x: u.x + (to.x - u.x) * factor,
      y: u.y + (to.y - u.y) * factor,
      hp: u.hp + (to.hp - u.hp) * factor,
    };
  });

  return { time: t, units, destroyedBuildingIds, brokenWallIds };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
