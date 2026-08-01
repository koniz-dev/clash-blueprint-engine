import type { BuildingCatalog, EventStore, GameRules, Village } from "@clash/engine";
import { Simulator } from "./simulation.js";
import { createDefaultTroopCatalog, type TroopCatalog } from "./troop.js";
import type { Deployment, SimulationOptions, SimulationResult } from "./types.js";

export {
  type TroopDefinition,
  type TroopCatalog,
  type MovementType,
  InMemoryTroopCatalog,
  DEFAULT_TROOPS,
  createDefaultTroopCatalog,
} from "./troop.js";
export {
  WALL_HITPOINTS,
  buildingHitpoints,
  buildingDamagePerSecond,
  defenseProfile,
  type DefenseProfile,
} from "./combat-stats.js";
export { Battlefield, type SimStructure, type SimWallState } from "./battlefield.js";
export { aStar, type AStarOptions, type PathResult } from "./pathfinding/astar.js";
export { computeFlowField, FlowField, type FlowFieldOptions } from "./pathfinding/flow-field.js";
export { Simulator } from "./simulation.js";
export {
  type Deployment,
  type SimulationOptions,
  type SimulationResult,
  type SimulationFrame,
  type SimEvent,
  type UnitFrame,
} from "./types.js";
export { replayStateAt, replayDuration, type ReplayState, type ReplayUnit } from "./replay.js";

export interface SimulateAttackConfig {
  readonly troops?: TroopCatalog;
  readonly options?: SimulationOptions;
  readonly eventStore?: EventStore;
  /** Game-specific rules (core category, HP, trap flags…). Defaults to Clash-like. */
  readonly rules?: GameRules;
}

/**
 * One-call convenience: run an attack with the default troop roster (unless a
 * catalog is supplied) and return the result.
 */
export function simulateAttack(
  village: Village,
  buildings: BuildingCatalog,
  deployments: ReadonlyArray<Deployment>,
  config: SimulateAttackConfig = {},
): SimulationResult {
  const troops = config.troops ?? createDefaultTroopCatalog();
  const simulator = new Simulator(village, buildings, troops, config.options, config.rules);
  simulator.deploy(deployments);
  return simulator.run(config.eventStore);
}
