import type { GridVec } from "@clash/shared";

export interface AStarOptions {
  readonly width: number;
  readonly height: number;
  readonly start: GridVec;
  /** True for any tile that is an acceptable destination. */
  isGoal(tile: GridVec): boolean;
  /** Cost to step onto a tile; `Infinity` means impassable. */
  enterCost(tile: GridVec): number;
  /** Admissible estimate of remaining cost from a tile to the nearest goal. */
  heuristic(tile: GridVec): number;
}

export interface PathResult {
  readonly path: ReadonlyArray<GridVec>;
  readonly cost: number;
}

/**
 * Weighted A* on a 4-connected tile grid. The key idea for this engine: walls
 * are *not* impassable — `enterCost` returns their break-time — so the same
 * search that finds a route also decides when cutting through a wall beats
 * walking around it. Ties break deterministically (lower h, then lower index)
 * so a given layout always yields the same path.
 */
export function aStar(options: AStarOptions): PathResult | null {
  const { width, height, start } = options;
  const size = width * height;
  const idx = (x: number, y: number): number => y * width + x;
  const startIdx = idx(start.x, start.y);

  const gScore = new Float64Array(size).fill(Infinity);
  const fScore = new Float64Array(size).fill(Infinity);
  const hScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);

  gScore[startIdx] = 0;
  hScore[startIdx] = options.heuristic(start);
  fScore[startIdx] = hScore[startIdx];

  // Binary min-heap of tile indices, ordered by (f, h, index).
  const heap: number[] = [startIdx];
  const less = (a: number, b: number): boolean =>
    fScore[a] !== fScore[b]
      ? fScore[a]! < fScore[b]!
      : hScore[a] !== hScore[b]
        ? hScore[a]! < hScore[b]!
        : a < b;
  const swap = (i: number, j: number): void => {
    const t = heap[i]!;
    heap[i] = heap[j]!;
    heap[j] = t;
  };
  const up = (i: number): void => {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (less(heap[i]!, heap[parent]!)) {
        swap(i, parent);
        i = parent;
      } else break;
    }
  };
  const down = (i: number): void => {
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < heap.length && less(heap[l]!, heap[smallest]!)) smallest = l;
      if (r < heap.length && less(heap[r]!, heap[smallest]!)) smallest = r;
      if (smallest === i) break;
      swap(i, smallest);
      i = smallest;
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

  while (heap.length > 0) {
    const current = pop();
    if (closed[current]) continue;
    const cx = current % width;
    const cy = (current - cx) / width;

    if (options.isGoal({ x: cx, y: cy })) {
      return reconstruct(cameFrom, current, width, gScore[current]!);
    }
    closed[current] = 1;

    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const neighbor = idx(nx, ny);
      if (closed[neighbor]) continue;
      const stepCost = options.enterCost({ x: nx, y: ny });
      if (!Number.isFinite(stepCost)) continue;
      const tentative = gScore[current]! + stepCost;
      if (tentative < gScore[neighbor]!) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentative;
        hScore[neighbor] = options.heuristic({ x: nx, y: ny });
        fScore[neighbor] = tentative + hScore[neighbor]!;
        push(neighbor);
      }
    }
  }

  return null;
}

function reconstruct(
  cameFrom: Int32Array,
  goalIdx: number,
  width: number,
  cost: number,
): PathResult {
  const path: GridVec[] = [];
  let node = goalIdx;
  while (node !== -1) {
    const x = node % width;
    path.push({ x, y: (node - x) / width });
    node = cameFrom[node]!;
  }
  path.reverse();
  return { path, cost };
}
