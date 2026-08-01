# Save format & migrations

Persisted layouts (JSON export, and the editor's `localStorage` autosave) carry
an explicit **`formatVersion`** so that a future change to the on-disk shape can
upgrade old files forward instead of silently breaking them.

## Where versioning lives

The engine's `VillageSnapshot` (`@clash/engine`) stays the **canonical, current,
in-memory shape** — it has **no** version field, so the core stays pure and
framework-free. Versioning is added only at the **serialization boundary**, in
`@clash/plugins` (`packages/plugins/src/save-format.ts`):

```ts
export const CURRENT_SAVE_VERSION = 1;

interface PersistedLayout {
  formatVersion: number;
  snapshot: VillageSnapshot; // the canonical current shape
}

serializeLayout(snapshot): string; // stamps CURRENT_SAVE_VERSION
migrateToCurrent(raw): Result<RawSnapshot, SaveFormatError>; // detect + migrate
parseSaveFile(text): Result<RawSnapshot, SaveFormatError>; // JSON.parse + migrate
```

- **Writers** stamp the current version: `jsonExporter` (`@clash/exporter`) and
  the editor autosave (`useEditor`) both call `serializeLayout`.
- **Readers** migrate before rebuilding: `jsonImporter` (`@clash/importer`) calls
  `parseSaveFile`, then does its structural validation, then the engine
  re-validates spatially in `Village.fromSnapshot`. Autosave restore flows
  through the same importer, so it migrates for free.

Everything returns a `Result` — a malformed file, an unknown/too-new version, or
a corrupt payload surfaces as an error, never a thrown exception or a crash.

## The migration chain

Versions are **monotonic integers**. Each bump ships one forward step in the
registry, keyed by the version it upgrades _from_:

```ts
const MIGRATIONS: Record<number, (data) => data> = {
  0: (data) => ({ ...data, tier: data.tier ?? data.townHall }), // v0 → v1
};
```

- **Version 0** is the pre-versioning era: a _bare_ snapshot object with no
  `formatVersion`. Its migration also folds the historical `townHall → tier`
  rename, so blueprints saved before the game-agnostic migration still load.
- `migrateToCurrent` reads the version (missing ⇒ 0), rejects anything **newer**
  than `CURRENT_SAVE_VERSION`, then applies each step in order up to current.

## Adding a new version (policy)

When you change the persisted shape:

1. Bump `CURRENT_SAVE_VERSION` to `N`.
2. Add `MIGRATIONS[N-1] = (data) => …` that transforms a version-`N-1` payload
   into a version-`N` one (pure function over the raw object).
3. Add a round-trip test at `N` and a fixture of an `N-1` payload that migrates.

Never edit an existing migration to mean something new — old files in the wild
depend on it. Only append.

## Tests

`packages/plugins/src/save-format.test.ts` covers round-trip at the current
version, an **old unversioned payload that migrates and loads**, and **too-new /
corrupt** payloads that error cleanly. `@clash/importer` and the
`examples/pipeline` round-trip exercise the same path end to end.
