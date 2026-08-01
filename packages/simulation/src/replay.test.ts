import { describe, expect, it } from "vitest";
import { replayDuration, replayStateAt } from "./replay.js";
import type { SimulationFrame } from "./types.js";

const unit = (id: string, x: number, y: number, hp = 100) => ({
  id,
  troopId: "barbarian",
  x,
  y,
  hp,
  targetId: undefined,
});

const timeline: SimulationFrame[] = [
  { time: 0, units: [unit("u1", 0, 0)], events: [] },
  {
    time: 1,
    units: [unit("u1", 10, 0)],
    events: [{ type: "buildingDestroyed", time: 1, buildingId: "b1", definitionId: "cannon" }],
  },
  {
    time: 2,
    units: [unit("u1", 10, 10, 50)],
    events: [{ type: "wallBroken", time: 2, wallId: "w1" }],
  },
];

describe("replayStateAt", () => {
  it("interpolates unit position linearly between frames", () => {
    const state = replayStateAt(timeline, 0.5);
    expect(state.units[0]?.x).toBeCloseTo(5);
    expect(state.units[0]?.y).toBeCloseTo(0);
  });

  it("snaps to a frame's exact values at frame times", () => {
    expect(replayStateAt(timeline, 1).units[0]?.x).toBeCloseTo(10);
    expect(replayStateAt(timeline, 2).units[0]?.hp).toBeCloseTo(50);
  });

  it("accumulates destruction from events up to t", () => {
    expect(replayStateAt(timeline, 0.9).destroyedBuildingIds.size).toBe(0);
    expect(replayStateAt(timeline, 1).destroyedBuildingIds.has("b1")).toBe(true);
    expect(replayStateAt(timeline, 1.5).brokenWallIds.size).toBe(0);
    expect(replayStateAt(timeline, 2).brokenWallIds.has("w1")).toBe(true);
  });

  it("clamps before the first and after the last frame", () => {
    expect(replayStateAt(timeline, -5).units[0]?.x).toBeCloseTo(0);
    const end = replayStateAt(timeline, 99);
    expect(end.units[0]?.x).toBeCloseTo(10);
    expect(end.units[0]?.y).toBeCloseTo(10);
  });

  it("is deterministic (same inputs, same output)", () => {
    expect(replayStateAt(timeline, 1.3)).toEqual(replayStateAt(timeline, 1.3));
  });

  it("reports the timeline duration", () => {
    expect(replayDuration(timeline)).toBe(2);
    expect(replayDuration([])).toBe(0);
  });
});
