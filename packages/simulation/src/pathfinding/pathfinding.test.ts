import type { GridVec } from "@clash/shared";
import { describe, expect, it } from "vitest";
import { aStar } from "./astar.js";
import { computeFlowField } from "./flow-field.js";

const manhattanTo = (goal: GridVec) => (t: GridVec) =>
  Math.abs(t.x - goal.x) + Math.abs(t.y - goal.y);

describe("aStar", () => {
  it("finds a shortest path on an open grid", () => {
    const goal = { x: 4, y: 4 };
    const result = aStar({
      width: 5,
      height: 5,
      start: { x: 0, y: 0 },
      isGoal: (t) => t.x === goal.x && t.y === goal.y,
      enterCost: () => 1,
      heuristic: manhattanTo(goal),
    });
    expect(result).not.toBeNull();
    expect(result!.cost).toBe(8);
    expect(result!.path[0]).toEqual({ x: 0, y: 0 });
    expect(result!.path.at(-1)).toEqual({ x: 4, y: 4 });
  });

  it("routes around impassable tiles", () => {
    const goal = { x: 4, y: 0 };
    const blocked = new Set(["2,0", "2,1", "2,2"]); // wall with a gap at y=3
    const result = aStar({
      width: 5,
      height: 5,
      start: { x: 0, y: 0 },
      isGoal: (t) => t.x === goal.x && t.y === goal.y,
      enterCost: (t) => (blocked.has(`${t.x},${t.y}`) ? Infinity : 1),
      heuristic: manhattanTo(goal),
    });
    expect(result).not.toBeNull();
    for (const tile of result!.path) expect(blocked.has(`${tile.x},${tile.y}`)).toBe(false);
  });

  it("prefers cutting through a cheap wall over a long detour", () => {
    // A vertical barrier across the whole grid; the only 'gap' is a cheap tile.
    const goal = { x: 4, y: 2 };
    const enterCost = (t: GridVec): number => {
      if (t.x === 2) return t.y === 2 ? 3 : 50; // breakable at y=2, very costly elsewhere
      return 1;
    };
    const result = aStar({
      width: 5,
      height: 5,
      start: { x: 0, y: 2 },
      isGoal: (t) => t.x === goal.x && t.y === goal.y,
      enterCost,
      heuristic: manhattanTo(goal),
    });
    expect(result).not.toBeNull();
    expect(result!.path).toContainEqual({ x: 2, y: 2 }); // went through the cheap gap
  });

  it("returns null when the goal is fully enclosed", () => {
    const goal = { x: 2, y: 2 };
    const wall = new Set(["1,2", "3,2", "2,1", "2,3"]);
    const result = aStar({
      width: 5,
      height: 5,
      start: { x: 0, y: 0 },
      isGoal: (t) => t.x === goal.x && t.y === goal.y,
      enterCost: (t) =>
        wall.has(`${t.x},${t.y}`) || (t.x === goal.x && t.y === goal.y) ? Infinity : 1,
      heuristic: manhattanTo(goal),
    });
    expect(result).toBeNull();
  });
});

describe("computeFlowField", () => {
  it("computes an integration field with distances rising away from the goal", () => {
    const field = computeFlowField({
      width: 5,
      height: 5,
      goals: [{ x: 4, y: 4 }],
      enterCost: () => 1,
    });
    expect(field.costAt({ x: 4, y: 4 })).toBe(0);
    expect(field.costAt({ x: 0, y: 4 })).toBe(4);
    expect(field.costAt({ x: 0, y: 0 })).toBe(8);
  });

  it("points each tile toward the goal", () => {
    const field = computeFlowField({
      width: 5,
      height: 5,
      goals: [{ x: 4, y: 4 }],
      enterCost: () => 1,
    });
    const dir = field.directionAt({ x: 0, y: 0 });
    expect(dir).toBeDefined();
    // Moving right or down both reduce distance to (4,4).
    expect((dir!.x === 1 && dir!.y === 0) || (dir!.x === 0 && dir!.y === 1)).toBe(true);
    expect(field.directionAt({ x: 4, y: 4 })).toBeUndefined();
  });

  it("marks unreachable tiles as infinite cost", () => {
    const wall = new Set(["1,0", "1,1", "0,1"]); // seal off corner (0,0)
    const field = computeFlowField({
      width: 5,
      height: 5,
      goals: [{ x: 4, y: 4 }],
      enterCost: (t) => (wall.has(`${t.x},${t.y}`) ? Infinity : 1),
    });
    expect(field.costAt({ x: 0, y: 0 })).toBe(Infinity);
  });
});
