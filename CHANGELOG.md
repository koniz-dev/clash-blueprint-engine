# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/). The
project is pre-1.0 and ships from `main`; entries are grouped under `[Unreleased]`
until a tagged release is cut.

## [Unreleased]

### Added

- **Versioned, migratable save format.** Persisted layouts (JSON export and the
  editor's autosave) carry an explicit `formatVersion`; a migration registry
  upgrades old payloads forward on load, and unknown/too-new/corrupt files fail
  as a `Result` error. See [docs/SAVE_FORMAT.md](docs/SAVE_FORMAT.md). (W1)
- **Town Hall 10 & 11 rule packs** for Clash of Clans as pure, validated data
  (illustrative numbers, not official). (W4)
- **Editor:** wall movement (drag + arrow-nudge) and a confirmation dialog before
  discarding an unsaved layout.
- **Unit tests for the extracted editor hooks** and an 80% coverage gate on
  `@clash/ui` logic modules. (U1)
- **Repo/CI hardening:** Dependabot, CodeQL scanning, a coverage gate in CI, a
  GitHub Pages deploy for the TypeDoc API docs, issue/PR templates, and a security
  policy. (U2)

### Changed

- **Refactored the `useEditor` "God hook"** into ten focused, composable hooks
  (`useSelection`, `useClipboard`, `useQueries`, `useReplay`, `usePersistence`,
  `useKeyboardShortcuts`, `useEngineBinding`, `useLog`, `useHelp`,
  `useDiscardGuard`); no public API or behavior change. (W2)
- **Entity-agnostic selection** — walls (and any future entity kind) select,
  delete and move through the same command/undo path as buildings. (W3)
- CI upgraded to Node 22 with current action majors (checkout v7, setup-node v7,
  pnpm v6).

## [0.1.0] — Foundation

Initial public monorepo: the framework-free, game-agnostic core
(`@clash/shared`, `@clash/engine`, `@clash/renderer`, `@clash/plugins`,
`@clash/rules-engine`, `@clash/analyzer`, `@clash/simulation`, `@clash/ai`,
`@clash/importer`, `@clash/exporter`), the Next.js + Konva editor (`@clash/ui`,
`apps/web`) with a 3D view, and Clash of Clans + Keep Siege shipped as data packs
under `data/games/`. Command/undo, event sourcing, validation, defense analysis,
deterministic attack simulation, and import/export plugins.
