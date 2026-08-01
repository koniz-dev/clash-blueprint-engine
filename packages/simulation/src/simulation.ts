import {
  DEFAULT_GAME_RULES,
  type BuildingCatalog,
  type EventStore,
  type GameRules,
  type Village,
} from "@clash/engine";
import type { GridVec, Vec2 } from "@clash/shared";
import { euclideanDistance } from "@clash/shared";
import { Battlefield, type SimStructure } from "./battlefield.js";
import { aStar } from "./pathfinding/astar.js";
import type { TroopCatalog, TroopDefinition } from "./troop.js";
import type {
  Deployment,
  SimEvent,
  SimulationFrame,
  SimulationOptions,
  SimulationResult,
  UnitFrame,
} from "./types.js";

interface Unit {
  readonly id: string;
  readonly def: TroopDefinition;
  pos: Vec2;
  hp: number;
  alive: boolean;
  deployed: boolean;
  readonly deployTime: number;
  targetId: string | undefined;
  path: GridVec[] | undefined;
  pathIndex: number;
  replanTimer: number;
}

const EPS = 1e-6;

function distPointToRect(
  p: Vec2,
  r: { x: number; y: number; width: number; height: number },
): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

const tileCenter = (t: GridVec): Vec2 => ({ x: t.x + 0.5, y: t.y + 0.5 });

/**
 * Deterministic, fixed-timestep attack simulator. Each tick: units acquire a
 * target (respecting favorite-target preference), path toward it (breaking
 * walls that block the cheapest route), and attack; defenses fire back at the
 * nearest in-range troop. Every step is a pure function of state — no ambient
 * randomness or time — so a battle replays identically.
 */
export class Simulator {
  readonly #battlefield: Battlefield;
  readonly #troops: TroopCatalog;
  readonly #tick: number;
  readonly #maxSeconds: number;
  readonly #frameSeconds: number;
  readonly #replanSeconds: number;

  #units: Unit[] = [];
  #time = 0;
  #idCounter = 0;
  readonly #events: SimEvent[] = [];
  readonly #frames: SimulationFrame[] = [];
  readonly #destructionOrder: { time: number; buildingId: string; definitionId: string }[] = [];
  #wallsBroken = 0;
  #lastFrameTime = -Infinity;
  #eventCursor = 0;

  constructor(
    village: Village,
    buildings: BuildingCatalog,
    troops: TroopCatalog,
    options: SimulationOptions = {},
    rules: GameRules = DEFAULT_GAME_RULES,
  ) {
    this.#battlefield = new Battlefield(village, buildings, rules);
    this.#troops = troops;
    this.#tick = options.tickSeconds ?? 0.1;
    this.#maxSeconds = options.maxSeconds ?? 180;
    this.#frameSeconds = options.frameSeconds ?? this.#tick;
    this.#replanSeconds = options.replanSeconds ?? 0.5;
  }

  /** Queue troops for deployment. Positions are in tile coordinates. */
  deploy(deployments: ReadonlyArray<Deployment>): this {
    for (const deployment of deployments) {
      const def = this.#troops.get(deployment.troopId);
      if (!def) throw new Error(`Unknown troop "${deployment.troopId}"`);
      this.#units.push({
        id: `u${++this.#idCounter}`,
        def,
        pos: { ...deployment.position },
        hp: def.hitpoints,
        alive: true,
        deployed: false,
        deployTime: deployment.time ?? 0,
        targetId: undefined,
        path: undefined,
        pathIndex: 0,
        replanTimer: 0,
      });
    }
    return this;
  }

  /** Run to completion. Optionally records Simulation{Started,Finished} events. */
  run(eventStore?: EventStore): SimulationResult {
    eventStore?.append({
      type: "SimulationStarted",
      units: this.#units.length,
      buildings: this.#battlefield.structuresTotal,
    });

    const maxTicks = Math.ceil(this.#maxSeconds / this.#tick);
    let ticks = 0;
    this.#deployDue(); // deploy t=0 troops
    this.#captureFrame(); // t=0 baseline
    while (ticks < maxTicks && !this.#isFinished()) {
      this.#time += this.#tick;
      this.#step();
      ticks++;
      if (this.#time - this.#lastFrameTime >= this.#frameSeconds - EPS) this.#captureFrame();
    }

    const result = this.#result(ticks);
    eventStore?.append({
      type: "SimulationFinished",
      destructionPercent: result.destructionPercent,
      stars: result.stars,
      durationSeconds: result.durationSeconds,
    });
    return result;
  }

  // --- Per-tick logic -----------------------------------------------------

  #step(): void {
    this.#deployDue();
    for (const unit of this.#units) {
      if (!unit.alive || !unit.deployed) continue;
      this.#actUnit(unit);
    }
    this.#defensesFire();
  }

  #deployDue(): void {
    for (const unit of this.#units) {
      if (!unit.deployed && unit.alive && unit.deployTime <= this.#time + EPS) {
        unit.deployed = true;
        this.#events.push({
          type: "deploy",
          time: this.#round(this.#time),
          unitId: unit.id,
          troopId: unit.def.id,
          x: unit.pos.x,
          y: unit.pos.y,
        });
      }
    }
  }

  #actUnit(unit: Unit): void {
    let target = unit.targetId ? this.#battlefield.structures.get(unit.targetId) : undefined;
    if (!target || target.destroyed) {
      target = this.#selectTarget(unit);
      unit.targetId = target?.id;
      unit.path = undefined;
    }
    if (!target) return; // nothing left to attack

    const distance = distPointToRect(unit.pos, target.bounds);
    if (distance <= unit.def.attackRange + EPS) {
      this.#attackStructure(unit, target);
      return;
    }
    this.#moveUnit(unit, target);
  }

  #selectTarget(unit: Unit): SimStructure | undefined {
    const alive = this.#battlefield.aliveStructures();
    if (alive.length === 0) return undefined;
    const preferred = unit.def.favoriteTarget
      ? alive.filter((s) => s.category === unit.def.favoriteTarget)
      : [];
    const pool = preferred.length > 0 ? preferred : alive;
    let best: SimStructure | undefined;
    let bestDist = Infinity;
    for (const structure of pool) {
      const d = distPointToRect(unit.pos, structure.bounds);
      if (
        d < bestDist - EPS ||
        (Math.abs(d - bestDist) <= EPS && (!best || structure.id < best.id))
      ) {
        best = structure;
        bestDist = d;
      }
    }
    return best;
  }

  #attackStructure(unit: Unit, target: SimStructure): void {
    // Damage handled through the battlefield so occupancy stays consistent.
    const destroyed = this.#battlefield.damageStructure(
      target.id,
      unit.def.damagePerSecond * this.#tick,
    );
    if (destroyed) {
      this.#destructionOrder.push({
        time: this.#round(this.#time),
        buildingId: target.id,
        definitionId: target.definitionId,
      });
      this.#events.push({
        type: "buildingDestroyed",
        time: this.#round(this.#time),
        buildingId: target.id,
        definitionId: target.definitionId,
      });
    }
  }

  #moveUnit(unit: Unit, target: SimStructure): void {
    if (unit.def.movement === "air") {
      this.#stepToward(unit, this.#nearestPointOnRect(unit.pos, target.bounds));
      return;
    }

    unit.replanTimer -= this.#tick;
    if (!unit.path || unit.replanTimer <= 0) {
      unit.path = this.#planPath(unit, target) ?? undefined;
      unit.pathIndex = unit.path && unit.path.length > 1 ? 1 : 0;
      unit.replanTimer = this.#replanSeconds;
    }
    if (!unit.path || unit.pathIndex >= unit.path.length) {
      // No route: inch straight toward the target so the unit isn't frozen.
      this.#stepToward(unit, this.#nearestPointOnRect(unit.pos, target.bounds));
      return;
    }

    const nextTile = unit.path[unit.pathIndex]!;
    const wallHp = this.#battlefield.wallHpAt(nextTile.x, nextTile.y);
    if (wallHp > 0 && !unit.def.ignoresWalls) {
      const { wallId, broken } = this.#battlefield.damageWallAt(
        nextTile.x,
        nextTile.y,
        unit.def.damagePerSecond * this.#tick,
      );
      if (broken) {
        this.#wallsBroken++;
        if (wallId)
          this.#events.push({ type: "wallBroken", time: this.#round(this.#time), wallId });
      }
      return; // stay put until the wall is down
    }

    const reached = this.#stepToward(unit, tileCenter(nextTile));
    if (reached) unit.pathIndex++;
  }

  /** Move up to one tick of movement toward `goal`; returns true if it arrived. */
  #stepToward(unit: Unit, goal: Vec2): boolean {
    const dx = goal.x - unit.pos.x;
    const dy = goal.y - unit.pos.y;
    const dist = Math.hypot(dx, dy);
    const step = unit.def.moveSpeed * this.#tick;
    if (dist <= step + EPS) {
      unit.pos = { x: goal.x, y: goal.y };
      return true;
    }
    unit.pos = { x: unit.pos.x + (dx / dist) * step, y: unit.pos.y + (dy / dist) * step };
    return false;
  }

  #planPath(unit: Unit, target: SimStructure): GridVec[] | null {
    const enterCost = this.#battlefield.groundEnterCost(unit.def.ignoresWalls);
    const range = unit.def.attackRange;
    const result = aStar({
      width: this.#battlefield.width,
      height: this.#battlefield.height,
      start: { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
      enterCost,
      isGoal: (tile) =>
        Number.isFinite(enterCost(tile)) &&
        distPointToRect(tileCenter(tile), target.bounds) <= range + EPS,
      heuristic: (tile) => euclideanDistance(tileCenter(tile), target.center),
    });
    return result ? [...result.path] : null;
  }

  #defensesFire(): void {
    for (const structure of this.#battlefield.structures.values()) {
      if (structure.destroyed || !structure.defense) continue;
      const profile = structure.defense;
      let victim: Unit | undefined;
      let bestDist = Infinity;
      for (const unit of this.#units) {
        if (!unit.alive || !unit.deployed) continue;
        const airborne = unit.def.movement === "air";
        if (airborne && !profile.targetsAir) continue;
        if (!airborne && !profile.targetsGround) continue;
        const d = distPointToRect(unit.pos, structure.bounds);
        if (
          d <= profile.range + EPS &&
          (d < bestDist - EPS || (victim && unit.id < victim.id && Math.abs(d - bestDist) <= EPS))
        ) {
          victim = unit;
          bestDist = d;
        }
      }
      if (victim) {
        victim.hp -= profile.dps * this.#tick;
        if (victim.hp <= 0) {
          victim.alive = false;
          this.#events.push({ type: "unitDied", time: this.#round(this.#time), unitId: victim.id });
        }
      }
    }
  }

  #nearestPointOnRect(p: Vec2, r: { x: number; y: number; width: number; height: number }): Vec2 {
    return {
      x: Math.max(r.x, Math.min(p.x, r.x + r.width)),
      y: Math.max(r.y, Math.min(p.y, r.y + r.height)),
    };
  }

  // --- Termination & output ----------------------------------------------

  #isFinished(): boolean {
    if (this.#battlefield.structuresAlive === 0) return true;
    const anyActive = this.#units.some((u) => u.alive && (u.deployed || u.deployTime > this.#time));
    return !anyActive;
  }

  #captureFrame(): void {
    this.#lastFrameTime = this.#time;
    const units: UnitFrame[] = this.#units
      .filter((u) => u.alive && u.deployed)
      .map((u) => ({
        id: u.id,
        troopId: u.def.id,
        x: this.#round(u.pos.x, 3),
        y: this.#round(u.pos.y, 3),
        hp: this.#round(u.hp, 1),
        targetId: u.targetId,
      }));
    const events = this.#events.slice(this.#eventCursor);
    this.#eventCursor = this.#events.length;
    this.#frames.push({ time: this.#round(this.#time), units, events });
  }

  #result(ticks: number): SimulationResult {
    const total = this.#battlefield.structuresTotal;
    const destroyed = total - this.#battlefield.structuresAlive;
    const destructionPercent = total === 0 ? 100 : this.#round((destroyed / total) * 100);
    const coreDestroyed =
      this.#battlefield.coreId === undefined ||
      (this.#battlefield.structures.get(this.#battlefield.coreId)?.destroyed ?? false);

    let stars = 0;
    if (destructionPercent >= 50) stars++;
    if (coreDestroyed) stars++;
    if (destroyed === total) stars++;

    return {
      durationSeconds: this.#round(this.#time),
      ticks,
      buildingsTotal: total,
      buildingsDestroyed: destroyed,
      destructionPercent,
      coreDestroyed,
      wallsBroken: this.#wallsBroken,
      stars,
      survivingUnits: this.#units.filter((u) => u.alive).length,
      destructionOrder: this.#destructionOrder,
      timeline: this.#frames,
      events: this.#events,
    };
  }

  #round(value: number, decimals = 2): number {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
  }
}
