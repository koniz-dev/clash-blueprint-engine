# Architecture

## Goals

The engine is designed so that **game logic never leaks into the UI** and the
core is **reusable across platforms and even across games**. Every decision
below serves that.

## Hexagonal (Ports & Adapters)

```
                 ┌─────────────────────────────────────────┐
   Adapters      │  React UI · CLI · Renderers · I/O       │
   (Phase 2+)    └───────────────▲───────────────▲─────────┘
                                 │ drives        │ subscribes
                 ┌───────────────┴───────────────┴─────────┐
   Application   │ VillageEditor · Commands · CommandStack │
   layer         │ EventStore                              │
                 └───────────────▲─────────────────────────┘
                                 │ mutates (returns Result)
                 ┌───────────────┴─────────────────────────┐
   Domain        │  Village (aggregate) · Grid · Building  │
   layer         │  Wall · Footprint · TileOccupancyIndex  │
                 └───────────────▲─────────────────────────┘
                                 │ depends on
                 ┌───────────────┴─────────────────────────┐
   Shared        │  Result · geometry · TypedEventEmitter  │
                 └─────────────────────────────────────────┘
```

Dependencies point **inward only**. `@clash/engine` has no dependency on any
framework or browser API. Ports are TypeScript interfaces:

- `BuildingCatalog` — resolves building _definitions_ (data source is swappable:
  JSON pack, test fixture, remote service).
- `IdGenerator` — source of identity, injected so the domain is deterministic
  and replayable (tests use a counter; production a UUID). The domain never
  calls `Math.random`/`crypto` directly.

## Domain layer (`packages/engine/src/domain`)

| Concept              | File                     | Responsibility                                                              |
| -------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `Grid`               | `grid.ts`                | Playfield extent; bounds checks. Config-driven (44×44, 48×48, …).           |
| `BuildingDefinition` | `building-definition.ts` | Data-driven building _type_. `BuildingCatalog` port + in-memory adapter.    |
| `BuildingInstance`   | `building.ts`            | A _placed_ building — plain serializable data.                              |
| `WallSegment`        | `wall.ts`                | A 1×1 wall piece (walls are independent objects).                           |
| `computeFootprint`   | `footprint.ts`           | Pure rotation → occupied tiles + bounds.                                    |
| `TileOccupancyIndex` | `spatial-index.ts`       | Tile → occupant map. **O(footprint)** placement/overlap and region queries. |
| `Village`            | `village.ts`             | **Aggregate root**. Sole guardian of spatial integrity.                     |
| `EngineError`        | `errors.ts`              | Recoverable failures returned via `Result`.                                 |

**Why an aggregate?** `Village` is the only object allowed to mutate layout
state, and it enforces two invariants on every change: everything is in-bounds
and nothing overlaps. Callers can never construct an invalid village — even
`fromSnapshot` re-validates. Game _rules_ (counts, unlock tiers, required
buildings) deliberately live outside the aggregate, in the rules engine, so the
aggregate stays reusable across progression tiers and other grid games. It
stores `tier` as an opaque integer and `category` as an opaque string — no
game-specific concept leaks into the core.

**Game-agnostic layer.** A `GameRules` port (in the engine core) captures the
behavioral projection of a game — its tier label, `coreCategory`, wall HP, and
per-category flags/roles (passable, targetable, "storage"…). `@clash/rules-engine`
builds one from a `game.json` manifest (`parseGameDefinition` → `gameRulesFrom`);
simulation, analyzer and AI accept it (defaulting to `DEFAULT_GAME_RULES`). No
package matches category string literals anymore — a defense is anything with an
attack range, the core is whatever the game designates. Adding a game is a data
pack; see [GAME_PACKS.md](GAME_PACKS.md).

**Why a Result type instead of exceptions?** Overlap and out-of-bounds are
_expected_ outcomes of a design tool, not bugs. Modelling them as `Result`
forces every caller to handle them and keeps control flow explicit. Exceptions
(`InvariantError`) are reserved for genuine programmer errors.

## Application layer (`packages/engine/src/application`)

### Command pattern

Every user action is a `Command` with `execute(ctx)` and `undo(ctx)`. Redo is
simply `execute` again — commands **capture generated identity on first run**, so
re-execution is deterministic (a redone "add" restores the _same_ building id).

Implemented: `AddBuilding`, `MoveBuilding`, `RotateBuilding`, `RemoveBuilding`,
`AddWall`, `RemoveWall`.

`CommandStack` provides standard editor undo/redo: a successful command is
pushed to the undo stack and clears the redo stack; a _failed_ command is never
recorded, so history only ever holds applied changes.

### Event sourcing

Commands also append past-tense `DomainEvent`s to an append-only `EventStore`.
Crucially, **undo appends the inverse event** (undoing an add appends
`BuildingDeleted`), so the log is a faithful, monotonic, replayable record of the
actual session — the substrate for timeline history, debugging and future
real-time collaboration.

### `VillageEditor` facade

The single port adapters drive. No adapter constructs commands or touches the
aggregate directly — it calls intention-revealing methods (`addBuilding`,
`moveBuilding`, `undo`, `load`, …) that each return a `Result`. This is what
keeps game logic out of React components.

## Performance

The `TileOccupancyIndex` makes placement and overlap checks **O(footprint)**
rather than O(objects), so a 1000-building village stays responsive. Region
queries (for viewport culling and marquee selection in Phase 2) iterate only the
queried tiles. A QuadTree variant can slot in behind the same interface if a
future workload needs sparse large-area queries.

## Testing strategy

- **Pure units** — `computeFootprint` (rotation math), `Result`, the event bus.
- **Aggregate invariants** — placement, overlap, bounds, snapshot round-trip.
- **Application integration** — command execution, undo/redo determinism, the
  event log as an ordered timeline, save/load.

Determinism (injected id generator, no ambient randomness/time in the domain)
makes every test reproducible and sets up event-log replay for later phases.
