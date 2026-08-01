import type { GridVec } from "@clash/shared";

export interface FlowFieldOptions {
  readonly width: number;
  readonly height: number;
  readonly goals: ReadonlyArray<GridVec>;
  /** Cost to step onto a tile; `Infinity` means impassable. */
  enterCost(tile: GridVec): number;
}

/**
 * A flow field: the least cost from every tile to the nearest goal (the
 * "integration field"), plus a pointer from each tile to the next tile along a
 * shortest route. Computed once with a multi-source Dijkstra, it lets *any*
 * number of units share one route computation — the efficient complement to
 * per-unit A* when a swarm converges on the same target.
 */
export class FlowField {
  readonly width: number;
  readonly height: number;
  readonly cost: Float64Array;
  readonly #next: Int32Array;

  constructor(width: number, height: number, cost: Float64Array, next: Int32Array) {
    this.width = width;
    this.height = height;
    this.cost = cost;
    this.#next = next;
  }

  costAt(tile: GridVec): number {
    return this.cost[tile.y * this.width + tile.x] ?? Infinity;
  }

  /** Unit step (dx, dy ∈ {-1,0,1}) toward the goal, or `undefined` at a goal / unreachable. */
  directionAt(tile: GridVec): GridVec | undefined {
    const next = this.#next[tile.y * this.width + tile.x];
    if (next === undefined || next < 0) return undefined;
    const nx = next % this.width;
    const ny = (next - nx) / this.width;
    return { x: Math.sign(nx - tile.x), y: Math.sign(ny - tile.y) };
  }

  nextTile(tile: GridVec): GridVec | undefined {
    const next = this.#next[tile.y * this.width + tile.x];
    if (next === undefined || next < 0) return undefined;
    const nx = next % this.width;
    return { x: nx, y: (next - nx) / this.width };
  }
}

export function computeFlowField(options: FlowFieldOptions): FlowField {
  const { width, height, goals } = options;
  const size = width * height;
  const idx = (x: number, y: number): number => y * width + x;

  const cost = new Float64Array(size).fill(Infinity);
  const next = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);

  const heap: number[] = [];
  const less = (a: number, b: number): boolean =>
    cost[a] !== cost[b] ? cost[a]! < cost[b]! : a < b;
  const swap = (i: number, j: number): void => {
    const t = heap[i]!;
    heap[i] = heap[j]!;
    heap[j] = t;
  };
  const up = (i: number): void => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(heap[i]!, heap[p]!)) {
        swap(i, p);
        i = p;
      } else break;
    }
  };
  const down = (i: number): void => {
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let s = i;
      if (l < heap.length && less(heap[l]!, heap[s]!)) s = l;
      if (r < heap.length && less(heap[r]!, heap[s]!)) s = r;
      if (s === i) break;
      swap(i, s);
      i = s;
    }
  };
  const push = (node: number): void => {
    heap.push(node);
    up(heap.length - 1);
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      down(0);
    }
    return top;
  };

  for (const goal of goals) {
    const i = idx(goal.x, goal.y);
    if (cost[i]! > 0) {
      cost[i] = 0;
      push(i);
    }
  }

  while (heap.length > 0) {
    const current = pop();
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cy = (current - cx) / width;

    // Relax neighbours by the cost to enter THIS tile from them (fields point
    // toward the goal, so we integrate the cost of the tile being stepped onto).
    const enterCurrent = options.enterCost({ x: cx, y: cy });
    if (!Number.isFinite(enterCurrent) && cost[current] !== 0) continue;

    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const neighbor = idx(nx, ny);
      if (closed[neighbor]) continue;
      // Cost for the neighbour to reach the goal = enter(current) + cost(current).
      const candidate = cost[current]! + Math.max(enterCurrent, 0);
      if (candidate < cost[neighbor]!) {
        cost[neighbor] = candidate;
        next[neighbor] = current;
        push(neighbor);
      }
    }
  }

  return new FlowField(width, height, cost, next);
}
