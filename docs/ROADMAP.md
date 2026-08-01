# Roadmap

Each phase is a self-contained increment: it ships working, tested code and does
not require rework of earlier phases. The hexagonal core means later phases add
**adapters and packages** around a stable domain, rather than rewriting it.

## Phase 1 — Foundation ✅ (done)

- [x] pnpm + Turborepo monorepo, strict TS, Vitest.
- [x] `@clash/shared`: `Result`, geometry, typed event bus, invariants, ids.
- [x] `@clash/engine` domain: `Grid`, `Building`, `Wall`, `Village` aggregate,
      `TileOccupancyIndex`, rotation/footprint math.
- [x] Command layer + `CommandStack` (undo/redo).
- [x] Event sourcing (`EventStore`, `DomainEvent`).
- [x] `VillageEditor` facade, snapshot save/load.
- [x] 31 tests, green typecheck.

## Phase 2 — Editor (`apps/web`, `packages/ui`) ✅ (done)

- [x] `@clash/ui`: `useEditor` hook — the React ⇆ engine binding, subscribing to
      `CommandStack` + `EventStore`, dispatching only through the facade (no game
      logic in React).
- [x] Konva `EditorCanvas`: zoom, pan, grid, placement preview, selection.
- [x] Tools: select / place (with rotation) / wall paint (drag) / delete.
- [x] Toolbar (New/Undo/Redo/Validate/Analyze/AI/Export) + library, inspector,
      stats, validation, defense-score and AI panels + live event log.
- [x] `apps/web` Next.js client shell; catalog/rules bundled from `data/*.json`;
      `next build` green. See [EDITOR.md](EDITOR.md).
- [x] Multi-select (shift-click) + copy/paste + keyboard shortcuts.
- [x] Wall auto-connect / corner detection (render model + canvas).
- [x] AI recommendations run in a **Web Worker** (off the main thread).
- [x] **Playwright** smoke tests drive the real browser (place → command →
      undo → analyze), all green.
- [x] **Marquee (drag-box) select** + shift-additive; hold Space to pan.
- [x] **PNG export** (retina 2× / 300 DPI) via `createPngExporter` + a browser
      SVG→canvas rasterizer, behind the `AsyncExporter` contract.
- [x] **Storybook** for `@clash/ui` (`build-storybook` green) with a shared
      `styles.css` the app also consumes.

---

**All seven phases are complete**, plus the cross-cutting tooling below.

## Phase 3 — Rules (`packages/rules-engine`, `data/`) ✅ (done)

- [x] JSON rule packs per Town Hall (`data/game-rules/townhall-8.json`, `-9.json`).
- [x] JSON building definitions (`data/buildings/*.json`) loaded through the
      existing `BuildingCatalog` port — **no engine code changes**.
- [x] Zod schemas validating the data boundary; `Result`-returning parsers.
- [x] Node `loadDataPack` adapter (only fs-touching code) with referential-
      integrity checks; pure entry point stays framework-free.
- [x] Composable `ValidationEngine` returning `error | warning | suggestion`
      (missing Town Hall, not-allowed, over-count, unlock level, wall limit,
      invalid coords).
- [x] `LayoutValidated` event wired into the timeline via `validateAndRecord`.
- [x] 14 tests (schema, validation, real-data loader); see
      [RULES_ENGINE.md](RULES_ENGINE.md).

## Phase 4 — Rendering, Export / Import ✅ (done)

- [x] `@clash/plugins`: `PluginRegistry` + `Renderer`/`Importer`/`Exporter`
      ports + the shared `Scene` render model. Registering a plugin needs no
      core edits; duplicate ids are rejected.
- [x] `@clash/renderer`: `buildScene`/`buildDocument` + **ASCII**, **SVG**,
      **Mermaid** renderers (deterministic, snapshot-tested).
- [x] `@clash/exporter`: **JSON** exporter + `rendererExporter` bridge (any
      renderer → a file exporter).
- [x] `@clash/importer`: **JSON** importer (structural validation; engine
      re-validates placement on rebuild).
- [x] Template library (`data/templates/th8-starter.json`).
- [x] `examples/pipeline` end-to-end integration test over real `data/`.
- [x] 22 tests (registry, 3 render snapshots, export, import round-trip,
      pipeline); see [RENDERING_AND_PLUGINS.md](RENDERING_AND_PLUGINS.md).
- [x] **PNG** (retina 2× / 300 DPI): `AsyncExporter` + `Rasterizer` ports and
      `createPngExporter` rasterize the SVG behind the export contract; the
      browser adapter lives in `@clash/ui`.

## Phase 5 — Analyzer (`packages/analyzer`) ✅ (done)

- [x] `LayoutAnalyzer`: weighted 0–100 defense score + S–F grade over a
      composable metric set.
- [x] Metrics: Town Hall protection, storage protection, air coverage, ground
      coverage, compartment quality, wall efficiency, entry points.
- [x] Real compartment detection (border flood-fill), dead-zone and
      isolated-wall detection.
- [x] Human-readable weak points with severity, located `area`, `subjects` and
      concrete recommendations.
- [x] Wired into `examples/pipeline`; 13 tests. See [ANALYZER.md](ANALYZER.md).

## Phase 6 — Simulation (`packages/simulation`) ✅ (done)

- [x] Pathfinding: **weighted A\*** (walls traversable at break-cost) and a
      **Dijkstra flow-field**.
- [x] Data-driven troop roster (Barbarian, Archer, Giant, Wizard, Dragon,
      P.E.K.K.A, Hog Rider) via a `TroopCatalog` port.
- [x] Deterministic fixed-timestep `Simulator`: target selection (favorite
      target), movement, wall-breaking, defensive fire, destruction order.
- [x] Stars / destruction %, replayable `timeline` of frames + `SimEvent`s,
      `SimulationStarted`/`Finished` events.
- [x] Wired into `examples/pipeline`; 14 tests. See [SIMULATION.md](SIMULATION.md).

## Phase 7 — AI (`packages/ai`) ✅ (done)

- [x] `RecommendationEngine` composing analyzer weak points + simulation probes
      into ranked, actionable recommendations.
- [x] `placement` advisor: searches a **clone** for legal, score-improving
      moves; projected score attached (validated, not hand-wavy).
- [x] `simulation-probe` advisor: attacks every side to locate the weakest
      approach from _measured_ outcomes.
- [x] `weak-points` advisor mapping static findings to guidance.
- [x] Pluggable `Advisor` interface for future LLM / computer-vision backends.
- [x] Wired into `examples/pipeline`; 6 tests. See [AI.md](AI.md).

## Cross-cutting ✅ (done)

- [x] `tsup` build outputs (ESM + `.d.ts`) per package, with `publishConfig`
      pointing at `dist` while dev keeps fast `src` exports.
- [x] **Prettier** + **ESLint** (flat config, typescript-eslint + react-hooks).
- [x] **GitHub Actions CI**: lint → typecheck → test → build, plus an e2e job.
- [x] **Performance benchmarks** (Vitest bench): 1000-building placement (~1 ms),
      occupancy queries, A\* and flow-field pathfinding on a 44×44 grid.
- [x] Docs: [architecture](ARCHITECTURE.md), [rules](RULES_ENGINE.md),
      [rendering & plugins](RENDERING_AND_PLUGINS.md), [analyzer](ANALYZER.md),
      [simulation](SIMULATION.md), [AI](AI.md), [editor](EDITOR.md).
- [x] **API-reference site** generated from every package's types via TypeDoc
      (`pnpm docs:api` → `docs/api/`).

---

**Everything in this roadmap is now complete.** ✅
