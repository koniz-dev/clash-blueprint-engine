import type { Vec2 } from "@clash/shared";

/** A troop placed on the battlefield at a position and (optional) time. */
export interface Deployment {
  readonly troopId: string;
  readonly position: Vec2;
  /** Seconds after start to deploy. Defaults to 0. */
  readonly time?: number;
}

export interface SimulationOptions {
  /** Fixed timestep in seconds (determinism). Default 0.1. */
  readonly tickSeconds?: number;
  /** Hard cap on battle length in seconds. Default 180. */
  readonly maxSeconds?: number;
  /** Record a replay frame at most this often. Default = tickSeconds. */
  readonly frameSeconds?: number;
  /** How often a unit replans its path. Default 0.5s. */
  readonly replanSeconds?: number;
}

export type SimEvent =
  | {
      readonly type: "deploy";
      readonly time: number;
      readonly unitId: string;
      readonly troopId: string;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: "buildingDestroyed";
      readonly time: number;
      readonly buildingId: string;
      readonly definitionId: string;
    }
  | { readonly type: "wallBroken"; readonly time: number; readonly wallId: string }
  | { readonly type: "unitDied"; readonly time: number; readonly unitId: string };

/** One unit's replay state at a frame. */
export interface UnitFrame {
  readonly id: string;
  readonly troopId: string;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly targetId: string | undefined;
}

export interface SimulationFrame {
  readonly time: number;
  readonly units: ReadonlyArray<UnitFrame>;
  readonly events: ReadonlyArray<SimEvent>;
}

export interface SimulationResult {
  readonly durationSeconds: number;
  readonly ticks: number;
  readonly buildingsTotal: number;
  readonly buildingsDestroyed: number;
  /** 0–100, by building count (walls and non-targetable buildings excluded). */
  readonly destructionPercent: number;
  /** Whether the core/HQ building was destroyed (true if the game has no core). */
  readonly coreDestroyed: boolean;
  readonly wallsBroken: number;
  /** 0–3: ≥50% ⇒ 1, core destroyed ⇒ +1, 100% ⇒ +1. */
  readonly stars: number;
  readonly survivingUnits: number;
  readonly destructionOrder: ReadonlyArray<{
    time: number;
    buildingId: string;
    definitionId: string;
  }>;
  readonly timeline: ReadonlyArray<SimulationFrame>;
  readonly events: ReadonlyArray<SimEvent>;
}
