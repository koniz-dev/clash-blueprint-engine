import type { Direction } from "@clash/analyzer";
import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type GameRules,
  type Village,
} from "@clash/engine";
import type { GridVec } from "@clash/shared";
import { simulateAttack, type TroopCatalog } from "@clash/simulation";
import type { AttackProbe } from "./types.js";

/** A balanced ground army used to probe every side identically. */
const DEFAULT_PROBE_ARMY: ReadonlyArray<string> = [
  "giant",
  "giant",
  "giant",
  "wizard",
  "wizard",
  "barbarian",
  "barbarian",
  "barbarian",
  "barbarian",
];

export interface ProbeOptions {
  readonly army?: ReadonlyArray<string>;
  readonly maxSeconds?: number;
}

const clamp = (v: number, max: number): number => Math.max(0, Math.min(v, max));

/**
 * Attack the base from each cardinal side with the *same* army and report how
 * far each assault gets. The side that yields the highest destruction is the
 * weakest approach — concrete, measured evidence (not a static heuristic) that
 * the recommendation engine turns into a "reinforce the X side" suggestion.
 * Simulation never mutates the village, so the four probes are independent.
 */
export function runAttackProbes(
  village: Village,
  catalog: BuildingCatalog,
  troops: TroopCatalog,
  options: ProbeOptions = {},
  rules: GameRules = DEFAULT_GAME_RULES,
): AttackProbe[] {
  const w = village.grid.width;
  const h = village.grid.height;
  const army = options.army ?? DEFAULT_PROBE_ARMY;
  const mid = Math.floor(army.length / 2);
  const maxSeconds = options.maxSeconds ?? 120;

  const sides: ReadonlyArray<{ direction: Direction; anchor: GridVec; axis: "x" | "y" }> = [
    { direction: "north", anchor: { x: Math.floor(w / 2), y: 0 }, axis: "x" },
    { direction: "south", anchor: { x: Math.floor(w / 2), y: h - 1 }, axis: "x" },
    { direction: "west", anchor: { x: 0, y: Math.floor(h / 2) }, axis: "y" },
    { direction: "east", anchor: { x: w - 1, y: Math.floor(h / 2) }, axis: "y" },
  ];

  return sides.map(({ direction, anchor, axis }) => {
    const deployments = army.map((troopId, i) => {
      const spread = i - mid;
      const position =
        axis === "x"
          ? { x: clamp(anchor.x + spread, w - 1), y: anchor.y }
          : { x: anchor.x, y: clamp(anchor.y + spread, h - 1) };
      return { troopId, position };
    });

    const result = simulateAttack(village, catalog, deployments, {
      troops,
      options: { maxSeconds },
      rules,
    });

    return {
      direction,
      deployment: anchor,
      destructionPercent: result.destructionPercent,
      stars: result.stars,
      coreDestroyed: result.coreDestroyed,
      durationSeconds: result.durationSeconds,
    };
  });
}
