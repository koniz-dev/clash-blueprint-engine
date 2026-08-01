import type { GridVec } from "@clash/shared";
import { bench, describe } from "vitest";
import { aStar } from "./astar.js";
import { computeFlowField } from "./flow-field.js";

const W = 44;
const H = 44;
const manhattan = (t: GridVec) => Math.abs(W - 1 - t.x) + Math.abs(H - 1 - t.y);

// A vertical wall barrier with a single gap, forcing a non-trivial detour.
const barrier = (t: GridVec): number => {
  if (t.x === 22 && t.y !== 22) return 40; // costly to break
  return 1;
};

describe("pathfinding on a 44×44 grid", () => {
  bench("A* corner-to-corner, open grid", () => {
    aStar({
      width: W,
      height: H,
      start: { x: 0, y: 0 },
      isGoal: (t) => t.x === W - 1 && t.y === H - 1,
      enterCost: () => 1,
      heuristic: manhattan,
    });
  });

  bench("A* corner-to-corner, weighted wall barrier", () => {
    aStar({
      width: W,
      height: H,
      start: { x: 0, y: 0 },
      isGoal: (t) => t.x === W - 1 && t.y === H - 1,
      enterCost: barrier,
      heuristic: manhattan,
    });
  });

  bench("flow field for the whole grid (shared by a swarm)", () => {
    computeFlowField({ width: W, height: H, goals: [{ x: W - 1, y: H - 1 }], enterCost: () => 1 });
  });
});
