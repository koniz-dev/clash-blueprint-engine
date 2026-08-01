# Attack Simulation Guide

`@clash/simulation` plays out an attack against a village: troops path in, break
walls, destroy buildings while defenses fire back, and the whole battle is
recorded as a **replayable timeline**. It is **deterministic** — a fixed
timestep and no ambient randomness or time, so a battle replays identically and
tests are reproducible.

## Usage

```ts
import { simulateAttack } from "@clash/simulation";

const result = simulateAttack(village, buildingCatalog, [
  { troopId: "giant", position: { x: 2, y: 2 } },
  { troopId: "giant", position: { x: 3, y: 2 } },
  { troopId: "wizard", position: { x: 2, y: 3 }, time: 2 }, // deploy at t=2s
]);

result.destructionPercent; // 0–100 (buildings only; walls/traps excluded)
result.stars; // 0–3
result.townHallDestroyed;
result.wallsBroken;
result.destructionOrder; // [{ time, buildingId, definitionId }, …]
result.timeline; // frames for replay
```

`Simulator` is the class behind it if you want to build the battlefield, deploy
in stages, and pass an `EventStore` to record `SimulationStarted` /
`SimulationFinished` on the shared timeline.

## Troops (data-driven)

Troops resolve through a `TroopCatalog` port, exactly like buildings. The
built-in roster (`DEFAULT_TROOPS`, mirrored in `data/troops/default.json`)
covers Barbarian, Archer, Giant, Wizard, Dragon, P.E.K.K.A and Hog Rider. Stats
are illustrative and internally consistent — rebalancing is a data edit.

| Field                          | Meaning                                    |
| ------------------------------ | ------------------------------------------ |
| `hitpoints`, `damagePerSecond` | Survivability and offense                  |
| `moveSpeed`                    | Tiles per second                           |
| `attackRange`                  | Reach in tiles (melee ≈ 1)                 |
| `movement`                     | `ground` or `air`                          |
| `favoriteTarget`               | Preferred category (Giant/Hog → `defense`) |
| `ignoresWalls`                 | Air units and wall-jumpers (Hog)           |

## Pathfinding

Two complementary pathfinders, both pure and tested:

- **Weighted A\*** ([`aStar`](../packages/simulation/src/pathfinding/astar.ts)) —
  per-unit routing on the tile grid. The key idea: **walls are not impassable**
  — their `enterCost` is a break-time — so the _same_ search that finds a route
  also decides when cutting through a wall beats walking around it. Buildings
  block; the goal is any tile within the troop's attack range of the target.
- **Flow field** ([`computeFlowField`](../packages/simulation/src/pathfinding/flow-field.ts)) —
  a multi-source Dijkstra "integration field" giving every tile its cost-to-goal
  and a pointer toward it. One computation serves an entire swarm converging on
  a target — the efficient complement to per-unit A\* at scale.

## The tick loop

Each fixed timestep, for every alive, deployed unit:

1. **Target** — reacquire if the current target died. Respects `favoriteTarget`
   (a Giant seeks the nearest defense), else nearest building; ties break by id.
2. **Attack or move** — if within `attackRange`, damage the target; otherwise
   advance along the A\* path. If the next path tile is a live wall (and the unit
   can't ignore walls), the unit **breaks the wall** instead of moving.
3. **Defenses fire** — every defense hits the nearest in-range troop it can
   target (air/ground), dealing `damagePerSecond × dt`; troops die at 0 HP.

Damage flows through the `Battlefield`, which keeps occupancy consistent as
walls fall and buildings are destroyed, so subsequent paths reflect the new
openings. Hit points come from each definition, falling back to category
defaults (`buildingHitpoints` / `WALL_HITPOINTS`) when unspecified.

## Result & replay

`SimulationResult.timeline` is an ordered list of `SimulationFrame`s, each with
the time, every unit's position/HP/target, and the `SimEvent`s that occurred
(`deploy`, `buildingDestroyed`, `wallBroken`, `unitDied`). That is everything a
renderer needs to animate attack paths and play the battle back. Stars follow
the game's rule: ≥ 50% ⇒ 1, Town Hall destroyed ⇒ +1, 100% ⇒ +1.

## Feeding Phase 7 (AI)

Run the simulation from several deploy positions and the results reveal _which_
attacks succeed and _where_ a base folds — a concrete, measured complement to
the analyzer's static weak points. Together they are the input the AI
recommendation engine will reason over.
