# Rules Engine Guide

`@clash/rules-engine` turns **data** into **enforced game rules**. Nothing about
any specific game is hardcoded: the category set, the progression axis, the core
building, buildings and per-tier limits all live in a **game pack** under
`data/games/<id>/`, are validated at load time, and drive a composable
validation engine. For the full game-agnostic story see
[GAME_PACKS.md](GAME_PACKS.md).

> Adding a building or a whole tier is a JSON edit; adding a whole **game** is a
> new pack directory — **no code changes**. The `loadGamePack` test proves this
> against the real Clash of Clans pack, and `examples/pipeline` adds a second
> game (`keep-siege`) to prove it again.

## Data layout

```
data/games/clash-of-clans/
  game.json             manifest: tier axis, categories, core, wall
  buildings/            arrays of building definitions (by category file)
    core.json  defense.json  resource.json  army.json  traps.json
  rules/
    tier-8.json         one rule pack per tier
    tier-9.json
  templates/            (optional) starter village snapshots
```

### Building definition

Matches the engine's `BuildingDefinition`. `category` is an open string checked
against the game's declared categories; `minTier` is the generic unlock tier.
Extra keys are rejected (strict schema).

```json
{
  "id": "cannon",
  "name": "Cannon",
  "category": "defense",
  "width": 3,
  "height": 3,
  "minTier": 1,
  "attackRange": 9,
  "damageType": "single",
  "targets": ["ground"]
}
```

### Rule pack

```json
{
  "tier": 8,
  "gridSize": 44,
  "walls": 225,
  "required": [{ "id": "town_hall", "min": 1, "max": 1 }],
  "buildings": [
    { "id": "cannon", "maxCount": 5 },
    { "id": "archer_tower", "maxCount": 6 }
  ]
}
```

`buildings[].id` must reference a building in the catalog, and every building's
`category`/`minTier` must be consistent with the manifest — the loader enforces
this referential integrity and fails loudly otherwise.

### Spatial / design rules (optional)

A pack may declare an optional `spatial` array of pure geometric constraints.
It is fully backward-compatible: packs without it parse unchanged (`spatial`
defaults to `[]`). Each entry is discriminated by `type`, selects buildings by
`{ "id": … }` or `{ "category": … }`, and carries an optional `severity`
(`error` | `warning` | `suggestion`) with a graded default. Distances are
measured **center-to-center** over footprint bounding boxes, in tiles, using the
entry's `metric` (`chebyshev` — king moves, the default — `manhattan`, or
`euclidean`).

```json
"spatial": [
  { "type": "centered", "target": { "id": "town_hall" }, "tolerance": 8 },
  { "type": "minSpacing", "target": { "id": "air_defense" }, "minDistance": 8 },
  { "type": "edgeBuffer", "buffer": 2 },
  {
    "type": "proximity",
    "target": { "id": "clan_castle" },
    "near": { "id": "town_hall" },
    "maxDistance": 12
  }
]
```

| Type         | Params                          | Fires when                                                       | Default severity |
| ------------ | ------------------------------- | ---------------------------------------------------------------- | ---------------- |
| `minSpacing` | `target`, `minDistance`         | Two targets are closer than `minDistance` (both are subjects).   | warning          |
| `edgeBuffer` | `buffer`, optional `target`     | A footprint sits within `buffer` tiles of any grid edge.         | warning          |
| `centered`   | `target`, `tolerance`           | A target is more than `tolerance` tiles (Chebyshev) from centre. | suggestion       |
| `proximity`  | `target`, `near`, `maxDistance` | A target has no `near` building within `maxDistance`.            | warning          |

Every finding carries `subjects` (the offending building ids), so violations
light up in the editor's live validation with no UI wiring. Constraints are
inert on packs that declare none. `enclosed` (a target must sit inside a walled
compartment) is intentionally deferred — it needs flood-fill, which would pull
`@clash/analyzer` into the pure engine; a shared enclosure helper is the planned
home for it.

## Loading (Node)

```ts
import { loadGamePack } from "@clash/rules-engine/node";

const result = await loadGamePack("data/games/clash-of-clans");
if (!result.ok) throw new Error(result.error.issues.join("\n"));

const { game, catalog, ruleSets, templates } = result.value;
const th8 = ruleSets.get(8)!;
```

`loadGamePack` is the **only** filesystem-touching code (`loadDataPack` remains
as a deprecated alias). The pure entry point `@clash/rules-engine` (schemas,
`parseGameDefinition`, `gameRulesFrom`, `buildRuleSet`, the validation engine)
has no Node dependency and runs anywhere. Parsing returns a `Result`, never
throws.

## Validation

```ts
import { ValidationEngine } from "@clash/rules-engine";

const report = new ValidationEngine().validate(editor.village, th8, catalog);
report.isValid; // false if any error-severity issue
report.bySeverity("warning"); // ReadonlyArray<ValidationIssue>
report.summary(); // { errors, warnings, suggestions }
```

Each issue carries a stable `code`, a `severity`, a human `message`, and the
`subjects` (entity ids) it concerns so the editor can highlight them.

### Built-in rules

| Rule                  | Severity           | Detects                                               |
| --------------------- | ------------------ | ----------------------------------------------------- |
| `coordinate-validity` | error              | Non-integer / out-of-grid positions (guards imports). |
| `required-buildings`  | error              | Missing required building / too few / too many.       |
| `building-allowed`    | error              | A building type not permitted at this tier.           |
| `building-count`      | error              | A type over its `maxCount`.                           |
| `tier-requirement`    | warning            | A building whose `minTier` exceeds the current tier.  |
| `wall-limit`          | error / suggestion | Over the wall limit; or zero walls (suggestion).      |
| `spatial-min-spacing` | data-driven        | Targets closer than the declared `minDistance`.       |
| `spatial-edge-buffer` | data-driven        | A building inside the grid-edge buffer band.          |
| `spatial-centered`    | data-driven        | A target too far from the grid centre.                |
| `spatial-proximity`   | data-driven        | A target with no required neighbour in range.         |

The four `spatial-*` rules are appended by `createDefaultRules` and read their
constraints from the pack's `spatial` array (see [Spatial / design
rules](#spatial--design-rules-optional)); their severity comes from the data.

Messages use the game's tier label (e.g. "Town Hall", "Keep Level"), supplied
via `GameRules`; pass it as the 4th argument to `ValidationEngine.validate`.

### Adding a rule (composition, not inheritance)

A rule is just an object implementing `ValidationRule`:

```ts
import { ValidationEngine, createDefaultRules, type ValidationRule } from "@clash/rules-engine";

const noLonelyTownHall: ValidationRule = {
  id: "town-hall-cover",
  validate: (ctx) => /* inspect ctx.village, return ValidationIssue[] */ [],
};

const engine = new ValidationEngine([...createDefaultRules(), noLonelyTownHall]);
```

This is how Phase 4 plugins and the Phase 5 analyzer will contribute checks
without touching this package.

## Timeline integration

`validateAndRecord(village, ruleSet, catalog, eventStore)` runs validation and
appends a `LayoutValidated` event (severity counts only) to the engine's event
log, so a validation pass shows up on the same replayable timeline as edits —
while the detailed report stays in this package, keeping the engine decoupled.
