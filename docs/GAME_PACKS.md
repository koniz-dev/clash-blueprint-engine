# Game Packs — adding a game with zero engine code

The engine is **game-agnostic**. Clash of Clans is just the first game, shipped
as a data pack under `data/games/clash-of-clans/`. A second game (`keep-siege`)
lives beside it purely as data — no engine, analyzer, simulation or UI code was
changed to add it. This guide shows how the abstraction fits together and how to
add your own game.

## The three generalizations

| Was (Clash-specific)                                                                         | Now (game-agnostic)                                                                                                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `townHall: number` on rule packs; `townHallRequired` on buildings                            | A generic **tier**: `tier` on packs, `minTier` on buildings, with a per-game **label** ("Town Hall", "Keep Level").                     |
| Closed `BuildingCategory` enum (`defense \| storage \| townhall \| …`)                       | Open `category: string`, validated against the game's **declared categories**.                                                          |
| The Town Hall designated by a special `townhall` category literal, hardcoded across packages | A **core building** designated by data (`coreCategory` in the manifest); behavior (traps, storages, HP) driven by category flags/roles. |

## Pack layout

```
data/games/<your-game>/
  game.json               manifest: tier axis, categories, core, wall
  buildings/*.json         arrays of building definitions
  rules/*.json             one rule pack per tier
  templates/*.json         (optional) starter village snapshots
```

Load it with the Node adapter (the only filesystem code):

```ts
import { loadGamePack } from "@clash/rules-engine/node";

const pack = await loadGamePack("data/games/keep-siege");
if (!pack.ok) throw new Error(pack.error.issues.join("\n"));
const { game, catalog, ruleSets, templates } = pack.value;
```

`loadGamePack` validates everything and returns a `Result`: unknown categories,
`minTier` outside the tier range, rule packs referencing missing buildings, or a
missing core building all fail loudly at load — never at runtime.

## `game.json` manifest

```jsonc
{
  "id": "keep-siege",
  "name": "Keep Siege",
  "tier": { "label": "Keep Level", "shortLabel": "KL", "min": 1, "max": 10 },
  "coreCategory": "keep", // which category is the base's core/HQ
  "wall": { "hitpoints": 200, "label": "Palisade" },
  "categories": [
    { "id": "keep", "label": "Keep", "hitpoints": 2000 },
    { "id": "turret", "label": "Turret", "hitpoints": 350 },
    { "id": "vault", "label": "Vault", "hitpoints": 700, "roles": ["storage"] },
    { "id": "snare", "label": "Snare", "hitpoints": 1, "passable": true, "targetable": false },
  ],
}
```

Category descriptor fields:

- **`hitpoints`** — default structure HP for the category (a building may override).
- **`passable`** — if `true`, buildings of this category don't block ground
  movement (traps, decorations). Default `false`.
- **`targetable`** — if `false`, troops don't attack it and it doesn't count
  toward destruction (traps). Default `true`.
- **`roles`** — open behavioral tags. The analyzer's storage metric keys on the
  `"storage"` role, so any game marks its resource stores with it.

## How the abstraction reaches each layer

Everything behavioral is projected into a small **`GameRules`** port (defined in
`@clash/engine`, built by `gameRulesFrom(game)` in `@clash/rules-engine`). The
downstream layers accept it (defaulting to `DEFAULT_GAME_RULES`, which matches
Clash conventions, so existing call sites keep working):

```ts
import { gameRulesFrom } from "@clash/rules-engine";
const rules = gameRulesFrom(pack.value.game);

new ValidationEngine().validate(village, ruleSet, catalog, rules); // tier label, allowances
analyzeLayout(village, catalog, rules); // core via coreCategory, storages via role
simulateAttack(village, catalog, deploys, { rules }); // core, trap flags, HP, coreDestroyed
recommendImprovements(village, catalog, { rules }); // core-building moves
buildScene(village, catalog, { tierLabel: rules.tierLabel }); // renderer label
```

Note what is **not** in `GameRules`: the `Village` aggregate core stays entirely
game-neutral (it stores `tier` as an opaque integer and `category` as an opaque
string). Category _display_ (color/symbol/label) is handled by the renderer's
theme with a graceful fallback for any category, so a new game renders sensibly
out of the box.

## Deriving "is this a defense?"

There is no `category === "defense"` check anywhere. A building is a defense iff
it declares an `attackRange` and a damaging `damageType` — so any game's
defensive buildings (a Cannon, an Arrow Turret, a Ballista…) are recognized by
their stats, not their category name.

## Checklist to add a game

1. Create `data/games/<id>/game.json` (tier, categories, `coreCategory`, wall).
2. Add `buildings/*.json` — every `category` must be declared in the manifest,
   every `minTier` within the tier range, and at least one building must have
   the core category.
3. Add `rules/*.json` — one per tier (allowances + required buildings).
4. `loadGamePack("data/games/<id>")` → validate → play. No code changes.

The `keep-siege` pack plus
[`examples/pipeline/src/demo-game.test.ts`](../examples/pipeline/src/demo-game.test.ts)
are a complete, tested worked example.
