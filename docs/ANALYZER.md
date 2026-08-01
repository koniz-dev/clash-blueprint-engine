# Layout Analyzer Guide

`@clash/analyzer` scores a village's defensive strength on a **0–100** scale and
explains _why_ — every deduction comes with a human-readable weak point and an
actionable recommendation. Like the validation engine, it is a **weighted set of
composable metrics**: adding a scoring dimension is registering a `Metric`, not
editing the analyzer.

## Usage

```ts
import { analyzeLayout } from "@clash/analyzer";

const score = analyzeLayout(village, catalog);

score.overall; // 0–100 weighted score
score.grade; // "S" | "A" | "B" | "C" | "D" | "F"
score.metrics; // per-dimension sub-scores + details
score.weakPoints; // flattened, most-severe-first, each with a recommendation
```

```ts
for (const w of score.weakPoints) {
  console.log(`[${w.severity}] ${w.message}`);
  if (w.recommendation) console.log(`   → ${w.recommendation}`);
}
// [critical] This base has no air defenses — it is wide open to dragons ...
//    → Add air defenses.
// [weak] The Town Hall sits toward the north side, away from the core.
//    → Move the Town Hall closer to the centre so attackers must break through more layers.
```

## Scoring dimensions

| Metric                 | Weight | What it measures                                           |
| ---------------------- | ------ | ---------------------------------------------------------- |
| `town-hall-protection` | 3      | Town Hall centrality + wall enclosure.                     |
| `storage-protection`   | 2      | Keeping storages out of the outer ring.                    |
| `air-coverage`         | 2      | Share of the base within an air defense's range.           |
| `ground-coverage`      | 2      | Share of the base within a ground defense's range.         |
| `compartment-quality`  | 2      | Defenses spread across sealed compartments; no dead zones. |
| `wall-efficiency`      | 1      | Walls connected and actually enclosing defenses.           |
| `entry-points`         | 1      | Every populated side of the base is defended.              |

`overall` is the weight-weighted average of the sub-scores. Grades: S ≥ 90,
A ≥ 80, B ≥ 70, C ≥ 55, D ≥ 40, else F.

## Compartment detection

The compartment metrics rest on a real geometric analysis
([`analyzeCompartments`](../packages/analyzer/src/compartments.ts)): flood-fill
the map border across every non-wall tile; tiles the fill can't reach are
_enclosed_, and their connected components are the **compartments**. Walls are
the only barrier (buildings are not) — matching how walls define regions in the
game. From this the analyzer derives:

- **Compartment quality** — how many sealed compartments hold buildings.
- **Dead zones** — enclosed areas of ≥ 4 empty tiles (walls protecting nothing).
- **Isolated walls** — segments with no adjacent wall (they seal nothing).
- **Defenses-behind-walls** — the share of defenses inside a compartment.

Cost is O(grid tiles) — a full 44×44 base is ~1,900 tiles.

## Weak points

Each `WeakPoint` carries a `severity` (`critical | weak | info`), a `message`,
an optional `recommendation`, an `area` (a cardinal `Direction`, `center`, or
`overall`) and the `subjects` (entity ids) it concerns — so the editor can jump
to and highlight the offending buildings. Directional weak points ("the north
side has weak air coverage") come from bucketing buildings by their direction
from the layout centre.

## Adding a metric (composition, not inheritance)

```ts
import { LayoutAnalyzer, createDefaultMetrics, type Metric } from "@clash/analyzer";

const heroPlacement: Metric = {
  id: "hero-placement",
  label: "Hero Placement",
  weight: 1,
  evaluate: (ctx) => ({
    metricId: "hero-placement",
    label: "Hero Placement",
    score: /* 0–100 from ctx.buildings / ctx.defenses / ctx.compartments */ 100,
    weight: 1,
    weakPoints: [],
    details: {},
  }),
};

const analyzer = new LayoutAnalyzer([...createDefaultMetrics(), heroPlacement]);
```

Every metric reads a precomputed `AnalysisContext` (enriched buildings, defense
units with range/target metadata, Town Hall, storages, compartment analysis), so
metrics stay cheap pure reads — no re-scanning the village.

## Feeding the AI phase

The `DefenseScore` — sub-scores, `details`, and located weak points — is exactly
the structured input Phase 7's recommendation engine consumes to propose
concrete moves. The analyzer finds _what_ is wrong and _where_; the AI phase
turns that into _do this_.
