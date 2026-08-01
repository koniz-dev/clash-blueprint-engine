# Editor Guide (`@clash/ui` + `apps/web`)

The visual editor is the one place a framework wraps _around_ the engine. The
guiding rule from the architecture holds here without exception: **no game logic
lives in React.** The UI renders a `Scene`, dispatches commands through the
`VillageEditor` facade, and re-renders by subscribing to engine events.

## Running it

```bash
pnpm install
pnpm --filter @clash/web dev     # http://localhost:3000
# or
pnpm --filter @clash/web build && pnpm --filter @clash/web start
```

## Architecture

```
apps/web (Next.js, client shell)
  app/page.tsx        dynamic import of the editor with { ssr: false } (Konva is browser-only)
  app/EditorClient    passes the bundled catalog + rule set into <EditorApp/>
  lib/data.ts         builds catalog + rule set from data/*.json via the rules-engine parsers

@clash/ui (React binding + components)
  useEditor.ts        THE binding — owns one VillageEditor and composes the hooks below
  hooks/              focused hooks: useSelection, useClipboard, useQueries, useReplay,
                      useKeyboardShortcuts, usePersistence, useHelp, useDiscardGuard, useEngineBinding, useLog
  EditorCanvas.tsx    Konva view over controller.scene; turns pointer input into controller actions
  Toolbar / BuildingLibrary / Panels   presentational, read controller state, call controller actions
  EditorApp.tsx       composition only
```

### `useEditor` — the composition root

```ts
const controller = useEditor({ catalog, ruleSet, gridSize: 44, tier: 8 });
```

It owns a single `VillageEditor` and **composes focused hooks** (each in
`@clash/ui`'s `hooks/`) into one controller — no single "God hook":

- **`useEngineBinding`** subscribes to `editor.history.onChanged` /
  `editor.events.onAppended`, bumping a `version` counter (which the `scene` memo
  keys on) so the view can never drift from the domain; `rebind` re-subscribes
  after a `load` swaps the stores.
- **`useSelection`** tracks the entity-agnostic selection (buildings **and**
  walls) and splits it by kind for the command layer.
- **`useClipboard`**, **`useReplay`**, **`useHelp`**, **`useDiscardGuard`** own
  their slices; **`useQueries`** runs `runValidation` / `runAnalysis` / `runAi`
  on demand into panel state; **`useKeyboardShortcuts`** dispatches from the
  `shortcuts.ts` registry; **`usePersistence`** does versioned autosave/restore.
- **Dispatches, never decides.** Every action calls a facade method and surfaces
  any `EngineError` to the log — no rules, geometry, or scoring in React.

Because the binding is this thin and modular, the same engine could be driven by
a Vue or Svelte hook, a CLI, or tests with no change to the core.

## Features

- **Canvas** (Konva): pan (drag), zoom (wheel, around the cursor), grid, live
  placement preview, selection highlight. Input is **pointer-based** (mouse, pen
  and **touch**): the same tap/drag/marquee/pan work on touchscreens, with
  **two-finger pinch-to-zoom**; `touch-action: none` hands gestures to the canvas
  instead of the browser.
- **Tools**: Select (inspect), Place (from the library, with rotation), Wall
  (click-drag paint, **auto-connecting** into runs and corners), Delete, and
  **Hand** (a Figma-style pan tool — `H`/`5` or hold Space in Select; drag to pan
  with a grab cursor).
- **Direct manipulation**: in the Select tool, **drag a building** to move it —
  a live dashed ghost previews the destination and the drop commits as **one**
  undoable command (a multi-selection moves together as one `MacroCommand`).
  **Arrow keys** nudge the selection one tile at a time. Empty-space drag still
  draws a marquee; hold **Space** to pan.
- **Selectable & movable walls**: walls are selected (click or marquee),
  highlighted, **dragged / arrow-nudged**, and deleted through the same
  selection + command path as buildings. A mixed building + wall gesture is one
  atomic, undoable step (`MoveWallCommand` preserves the wall's id; the facade's
  `moveEntities` builds one `MacroCommand`).
- **Drag aids**: while dragging, **alignment guides** appear where the moved
  selection's edges/centres line up with other entities, and a **minimap**
  (top-right) gives an overview of large layouts — click it to recenter the view
  (pan only). The guide/hit geometry is a pure, unit-tested module
  (`canvas-geometry.ts`).
- **Library search**: a search box filters the building library by name or
  category.
- **Multi-select & clipboard**: shift-click to add/remove from the selection;
  **drag a marquee box** in the Select tool; **⌘/Ctrl+C / V** to copy & paste;
  **⌘/Ctrl+Z / Shift+Z** undo/redo. All via the same commands.
- **Hotkeys & help**: tool switches (**V/P/W/D**, mirrored on **1–4**), **R** to
  rotate, and a **?** shortcut (plus a toolbar **? Help** button) opening the
  shortcuts overlay. See [Help & shortcuts](#help--shortcuts).
- **Open & templates**: the toolbar's **Open ▾** menu loads a bundled **template**
  gallery or **imports a JSON** blueprint the user picks (parsed by the same
  `jsonImporter` the CLI uses; invalid files surface as errors, never crashes).
  When the current layout is non-empty, **New / Open / Import first ask for
  confirmation** (`ConfirmDialog`) so work isn't silently discarded. The layout
  **autosaves** to `localStorage` and is **restored** on the next visit (opt-in
  via a `persistKey`).
- **Attack replay**: the **Attack Replay** panel deploys troops (pick a troop,
  then click the canvas to drop attackers) and **plays a deterministic attack** —
  `simulateAttack` runs in `@clash/simulation`; the canvas animates the returned
  timeline (interpolated troop dots, buildings dimming as they fall, walls
  breaking) with **play/pause/scrub/speed**. See [Attack replay](#attack-replay).
- **Toolbar**: New, Open, Undo, Redo, Validate, Analyze, AI Suggest, Export JSON
  / ASCII / **PNG** (retina 2×; the SVG render rasterized to a canvas) / **glTF**
  (the 3D layout as a self-contained glTF 2.0 model, via the `Exporter` port).
- **Left panel**: building library grouped by category.
- **Undo-history panel**: a read-only projection of the engine's command stack
  (`CommandStack.entries`) — applied commands oldest→newest with the current
  state marked, undone commands dimmed. Click any row to **jump** to that point
  (the panel issues the right number of undo/redo commands via the facade; it
  holds no history state of its own).
- **Right panel**: Inspector (rotate / copy / delete; a multi-select summary),
  History, Attack Replay controls, Statistics, Validation results, Defense Score with
  per-metric bars, and ranked AI suggestions — each "move" suggestion has an
  **Apply** button that runs the move as a command (so it's undoable).
- **Bottom panel**: a live log of engine events and errors — the `EventStore`
  timeline made visible.

## 3D view

A **2D / 3D** toggle in the toolbar swaps the centre pane between the Konva 2D
canvas and an interactive three.js scene — both driven by the **same** `Scene`.

- **Flat/blocky**: each building is a box sized to its footprint `bounds`,
  coloured by `category` (shared renderer theme) and heighted by a small
  category table; the game's **core building** (data-designated via
  `coreCategory`) is the tallest with an accent. Walls render as connected
  segments from `connections`/`shape`, mirroring the 2D auto-connect. Ground
  plane + tile grid, a directional light with shadows, and orbit / pan / zoom
  (drei `OrbitControls`) framed on the whole base.
- **View-only, shared selection**: editing stays in the 2D canvas; clicking a
  building in 3D selects it (synced with 2D via `selectedIds`), hover highlights,
  and clicking empty space clears the selection.
- **Isolated & lazy**: the mesh mapping is a pure, three-free function —
  `build3DModel(scene, { coreCategory })` in `@clash/renderer` (deterministic,
  snapshot-tested). All three.js / `@react-three/*` code lives in
  `@clash/ui`'s `EditorScene3D`, which is `React.lazy`-loaded on first toggle, so
  three.js never enters the initial editor bundle (the route's First-Load JS is
  unchanged) and never touches any core package.

## Help & shortcuts

Keyboard shortcuts have **one source of truth**: the declarative registry in
`@clash/ui`'s [`shortcuts.ts`](../packages/ui/src/shortcuts.ts). Each entry is
`{ id, label, group, keys, when?, run }` where `keys` is a list of `KeyCombo`s
(`{ key, mod?, shift? }`; `mod` = ⌘ on macOS / Ctrl elsewhere, and `true` /
`false` / `undefined` mean require / forbid / ignore that modifier). Two
consumers read the same list, so they can never drift:

- **The keydown handler** in `useEditor.ts` is a thin dispatcher — it skips
  text-input targets, then `resolveShortcut(e)` → `preventDefault` (if the entry
  asks) → `run(ctx, key)`. `ctx` is built from the controller's own actions
  (`undo`, `setTool`, `rotate`, …), so no binding logic lives in the handler.
- **The help overlay + toolbar tooltips** render from the same array
  (`formatCombo` shows ⌘ vs Ctrl per platform).

This module is pure presentation — it imports no engine/domain code (only the
`Tool` string-union type, erased at build). A unit test
([`shortcuts.test.ts`](../packages/ui/src/shortcuts.test.ts)) asserts there are
**no conflicting bindings** and that `resolveShortcut` maps every event to the
expected shortcut (locking behavior).

**Bindings**

| Group     | Action                         | Keys                  |
| --------- | ------------------------------ | --------------------- |
| Edit      | Undo / Redo                    | ⌘Z · ⌘⇧Z / ⌘Y         |
| Edit      | Copy / Paste                   | ⌘C / ⌘V               |
| Selection | Delete selection               | Del / ⌫               |
| Selection | Nudge selection                | ↑ ↓ ← →               |
| Selection | Rotate selection               | R                     |
| Tools     | Select / Place / Wall / Delete / Hand | V·1 / P·2 / W·3 / D·4 / H·5 |
| View      | Show shortcuts                 | ?                     |

Plus mouse gestures (drag = marquee, drag a building = move, Shift+click =
add/remove, Space+drag = pan, wheel = zoom), also listed in the overlay.

**The overlay** ([`ShortcutsOverlay.tsx`](../packages/ui/src/ShortcutsOverlay.tsx))
is a right **side sheet**, opened by the toolbar **? Help** button or the `?`
key. It's a presentational component (given the shortcut metadata + an
`onClose`), and accessible: `role="dialog"` + `aria-modal`, focus moved in on
open and **restored on close**, **Tab** is focus-trapped, **Esc** closes. A
dismissible **first-run hint** points to the Help button and is remembered in
`localStorage` (`${persistKey}:help-hint`, reusing the autosave-key convention).
Toolbar/tool buttons carry `title` tooltips showing the action **and** its
hotkey. A Storybook story
([`ShortcutsOverlay.stories.tsx`](../packages/ui/src/ShortcutsOverlay.stories.tsx))
keeps the overlay in sync (⌘ and Ctrl variants).

## Attack replay

The replay is a textbook case of the boundary: **the battle is computed in the
engine, the UI only projects it.**

- **Compute**: `useEditor.runReplay(deployments)` calls `simulateAttack(village,
catalog, deployments, { rules })` from `@clash/simulation` and stores the
  returned `SimulationResult`. No combat, pathfinding, or damage math lives in
  React — it's the same deterministic simulator the AI and tests drive.
- **Project**: `replayStateAt(timeline, t)` (pure, in `@clash/simulation`,
  unit-tested) samples the recorded `SimulationFrame[]` at an arbitrary time —
  linearly interpolating unit positions between frames and accumulating
  destroyed-building / broken-wall sets from the events at or before `t`. The
  canvas renders that snapshot: troop dots, dimmed rubble, broken walls.
- **Animate**: a `requestAnimationFrame` clock in `useEditor` advances the
  playback time by wall-clock × speed while playing; **play/pause/scrub/speed**
  just move that clock. Because the projection is pure, scrubbing to any time is
  exact and reproducible.

Deployments are placed on the main thread (the sim is milliseconds for a normal
base). Nothing here reimplements engine logic — the panel and canvas overlay are
views over engine-produced data, exactly like the `Scene`.

## Internationalization (i18n)

The editor UI ships an **English + Vietnamese** scaffolding (`@clash/ui`'s
`i18n/`). Strings live in typed catalogs (`messages.ts` is the English source of
truth; `vi.ts` is typed as `Messages`, so a missing key is a **compile error**).
A tiny `I18nProvider` + `useI18n()` expose `t(key)` and `locale`/`setLocale`
(persisted to `localStorage`); the toolbar's `LanguageSwitcher` toggles languages
live. It's pure UI chrome — no game logic, no dependency — and the toolbar plus
panel titles are externalized as the worked example; more strings move over by
adding keys. A unit test enforces catalog-key parity.

## Why the boundary matters

Everything the user does becomes an engine **command** (undoable, event-sourced),
and everything they see is a **projection** of engine state. Validation, scoring,
and AI are the same functions the CLI and tests call. The React layer is
genuinely replaceable — which is the entire point of the hexagonal core the
earlier phases built.

## AI in a Web Worker

`@clash/ui` stays worker-agnostic: `useEditor` accepts an optional
`analyzeAsync` callback (the `AnalyzeAsync` contract). When present, "AI Suggest"
serializes `{ snapshot, definitions }`, runs the recommendation — which simulates
attacks from every side — **off the main thread**, and applies the returned
report. `apps/web` supplies this via a `Worker` (`app/ai.worker.ts` +
`lib/ai-client.ts`); tests and non-worker hosts fall back to a synchronous run.

## End-to-end tests

`apps/web/e2e/editor.spec.ts` drives the **real** editor in Chromium via
Playwright: it loads the shell, places a building through the library + canvas
(asserting the `BuildingPlaced` event reaches the log — i.e. the command ran end
to end), undoes it, and runs analysis to see a defense score. It also covers the
newer interactions: **dragging** a building to move it (asserting `BuildingMoved`

- one-undo revert), **selecting and deleting a wall**, **opening a bundled
  template**, and **deploying troops and playing an attack replay** (transport
  controls appear). `pnpm --filter @clash/web test:e2e`.

## Storybook & API reference

- `@clash/ui` ships **Storybook** (`pnpm --filter @clash/ui storybook`, or
  `build-storybook`): stories for the full `EditorApp`, the `Toolbar`, and the
  `BuildingLibrary`. The editor CSS lives in `@clash/ui/styles.css`, imported by
  both the app and Storybook so they stay in sync.
- **API reference**: `pnpm docs:api` runs TypeDoc over every package's public
  entry point into `docs/api/`.

## Notes

- The editor is client-only (`dynamic(..., { ssr: false })`) because Konva needs
  the browser; `next.config.mjs` stubs the optional native `canvas` module and
  teaches webpack the workspace's `.js`→`.ts` import specifiers. Storybook's Vite
  builder gets the same `.js`→`.ts` resolution via a small `viteFinal` plugin.
- PNG export rasterizes the SVG renderer's output on a 2× canvas
  (`RETINA_SCALE`; `DPI_300_SCALE` ≈ 300 DPI is available) — the pure
  `createPngExporter` stays environment-free by taking the rasterizer as a port.
