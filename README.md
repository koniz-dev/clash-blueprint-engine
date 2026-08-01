# Clash Blueprint Engine

[![CI](https://github.com/koniz-dev/clash-blueprint-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/koniz-dev/clash-blueprint-engine/actions/workflows/ci.yml)
[![CodeQL](https://github.com/koniz-dev/clash-blueprint-engine/actions/workflows/codeql.yml/badge.svg)](https://github.com/koniz-dev/clash-blueprint-engine/actions/workflows/codeql.yml)
[![API docs](https://img.shields.io/badge/docs-API%20reference-blue)](https://koniz-dev.github.io/clash-blueprint-engine/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade, **framework-independent**, **game-agnostic** engine for
designing, validating, analyzing and simulating grid-based base layouts. Clash
of Clans is the first game — shipped entirely as a data pack under
`data/games/clash-of-clans/`; a second game slots in as data with **zero engine
code** (see [docs/GAME_PACKS.md](docs/GAME_PACKS.md)). Built like a game-level
editor / CAD tool, not a drawing app.

The core engine has **zero dependencies on React, Next.js, Konva, Canvas or any
browser API**, so the same domain logic runs on web, CLI, desktop and mobile.

## Status

**All 7 phases complete and green** — plus every roadmap follow-up. ✅ · **103
unit tests** + **3 Playwright e2e**, strict `tsc` clean, ESLint + Prettier clean,
`turbo run build` (tsup `.d.ts` for every package + `next build`) + Storybook
build passing, and **CI** wired. The framework-free engine now has a Next.js +
Konva editor wrapped around it — with zero game logic in React.

**Quality gates** (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`):
Prettier + ESLint, per-package `tsup` builds, Vitest unit tests + benchmarks,
Playwright browser e2e, Storybook, a TypeDoc API site (`pnpm docs:api`), and a
GitHub Actions workflow running all of it.

- `@clash/shared` — `Result`, geometry, a typed event bus, invariants, branded ids.
- `@clash/engine` — the hexagonal core: `Grid`, `Building`, `Wall`, the `Village`
  aggregate, an O(footprint) tile-occupancy spatial index, the full **Command**
  layer with **undo/redo**, and an append-only **event store** (event sourcing).
- `@clash/rules-engine` — **data-driven** game packs: a `game.json` manifest
  (tier axis, open category set, core building), buildings & per-tier rule packs
  (zod-validated), a `GameRules` projection, a composable **validation engine**
  (`error | warning | suggestion`), and a Node `loadGamePack` loader.
- `@clash/plugins` + `@clash/renderer` + `@clash/exporter` + `@clash/importer` —
  a **plugin registry** with `Renderer`/`Importer`/`Exporter` ports, **ASCII /
  SVG / Mermaid** renderers, and **JSON** import/export that round-trips a
  layout exactly. Adding a format is a registration, not a core edit.
- `@clash/analyzer` — a weighted **0–100 defense score** + S–F grade over
  composable metrics (TH/storage protection, air/ground coverage, compartment
  quality, wall efficiency, entry points), real **compartment / dead-zone
  detection**, and located, actionable **weak points**.
- `@clash/simulation` — a **deterministic attack simulator**: weighted A\* +
  flow-field pathfinding, data-driven troops, wall-breaking, defensive fire, and
  a replayable timeline with stars / destruction %.
- `@clash/ai` — a **recommendation engine** composing analyzer weak points and
  simulation probes into ranked, actionable suggestions, including
  **validated, score-improving** building moves. Pluggable advisor backend for
  future LLM / computer vision.
- `@clash/ui` + `apps/web` — a **Next.js + Konva editor**: pan/zoom canvas,
  place/wall/select/delete tools, undo/redo, and live validation / defense-score
  / AI panels. The React layer is a thin binding (`useEditor`) over the engine
  facade — **no game logic in components**.
- `examples/pipeline` — an end-to-end integration test over the real `data/`.

The **generated API reference** is published to GitHub Pages:
**<https://koniz-dev.github.io/clash-blueprint-engine/>** (run it locally with
`pnpm docs:api`).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the remaining phase, and the design
guides: [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[RULES_ENGINE](docs/RULES_ENGINE.md) ·
[RENDERING_AND_PLUGINS](docs/RENDERING_AND_PLUGINS.md) ·
[ANALYZER](docs/ANALYZER.md) · [SIMULATION](docs/SIMULATION.md) ·
[AI](docs/AI.md) · [EDITOR](docs/EDITOR.md) · [GAME_PACKS](docs/GAME_PACKS.md) ·
[SAVE_FORMAT](docs/SAVE_FORMAT.md).

Project meta: [CHANGELOG](CHANGELOG.md) · [CONTRIBUTING](CONTRIBUTING.md) ·
[SECURITY](SECURITY.md).

## Quick start

```bash
pnpm install
pnpm -r typecheck   # strict type check across the workspace
pnpm -r test        # run every package's test suite
```

## Using the engine

```ts
import { VillageEditor, InMemoryBuildingCatalog } from "@clash/engine";

const catalog = new InMemoryBuildingCatalog([
  { id: "cannon", name: "Cannon", category: "defense", width: 3, height: 3, minTier: 1 },
]);

const editor = VillageEditor.forGridSize(44, catalog, /* tier */ 8);

const added = editor.addBuilding("cannon", { x: 10, y: 10 });
if (added.ok) {
  editor.moveBuilding(added.value, { x: 12, y: 12 });
  editor.undo(); // back to (10,10)
  editor.redo(); // forward to (12,12) — same building id
}

const snapshot = editor.toSnapshot(); // serialize
editor.events.all(); // replayable timeline of every edit
```

Every mutation returns a `Result`, so overlaps, out-of-bounds placements and
unknown buildings are handled values — never thrown exceptions.

## Repository layout

```
apps/web/            Next.js + Konva editor     ✅
packages/
  shared/            primitives                 ✅
  engine/            domain + application core  ✅
  rules-engine/      data-driven game rules     ✅
  plugins/           plugin registry + ports    ✅
  renderer/          ASCII/SVG/Mermaid          ✅
  exporter/          JSON + renderer bridge     ✅
  importer/          JSON import                ✅
  analyzer/          defense scoring            ✅
  simulation/        attack pathfinding + sim   ✅
  ai/                layout recommendations     ✅
  ui/                React editor components    ✅
examples/pipeline/   end-to-end integration     ✅ (+ zero-code demo game)
data/games/<id>/     per-game packs: game.json + buildings/rules/troops/templates
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the quality gates, and the
architecture rules (no game logic in React; the core stays framework-free).

## Disclaimer

This is an unofficial fan project, provided for educational and non-commercial
purposes. It is **not affiliated with, endorsed, sponsored, or specifically
approved by Supercell**, and Supercell is not responsible for it. "Clash of
Clans" and related names are trademarks of Supercell. This repository ships no
Supercell game assets; the bundled data (building/troop stats) is illustrative,
not official game data. See Supercell's
[Fan Content Policy](https://supercell.com/en/fan-content-policy/).

## License

Licensed under the [MIT License](LICENSE).
