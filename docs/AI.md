# AI Recommendation Engine Guide

`@clash/ai` turns analysis into advice. It composes the **analyzer** (static
weak points) and the **simulator** (measured attack outcomes) into a ranked list
of concrete, often machine-actionable recommendations — the "suggested
improvements / defense movement / better compartment design" the project set out
to produce.

## Usage

```ts
import { recommendImprovements } from "@clash/ai";

const report = recommendImprovements(village, catalog);

report.defenseScore; // the analyzer's DefenseScore
report.probes; // 4 directional attack results
report.recommendations; // ranked high → low
```

Each `Recommendation` has a `priority`, a `title`, a `detail`, a `rationale`
(the _evidence_), and often a machine-actionable `action`:

```ts
for (const r of report.recommendations) {
  console.log(`[${r.priority}] ${r.title}`);
  console.log(`   ${r.detail}`);
  console.log(`   why: ${r.rationale}`);
  if (r.action?.type === "move") applyMove(r.action.buildingId, r.action.to);
}
```

`action` maps straight onto engine commands (`move`, `addBuilding`, `addWalls`),
so the editor can apply a suggestion with one click.

## How it works — three composable advisors

The engine runs a list of `Advisor`s over a shared context (the precomputed
defense score + attack probes) and merges their output. Adding an advisor —
including a future LLM- or vision-backed one — is extending the list; **the
engine never changes.**

### 1. `weak-points` — static findings → guidance

Translates every analyzer weak point (missing air defense, exposed side, dead
zones, isolated walls…) into a recommendation, carrying the metric score as
evidence. Cheap and always available.

### 2. `placement` — _validated_, score-improving moves

For an exposed Town Hall or storage, it searches for a better tile by trying
candidates on a **clone** of the village and re-validating each move through the
aggregate. It only surfaces a move that is **legal** (in-bounds,
non-overlapping) and **measurably raises the overall defense score** — the
projected score is attached. This is what makes "move X to (r, c)" trustworthy
rather than hand-wavy; a test asserts the projected score beats the baseline.

```
searchBetterPlacement(village, catalog, buildingId, idealCenter, evaluate)
  → clone → try candidate → re-validate → analyze → keep the best legal improvement
```

### 3. `simulation-probe` — measured weak side

Attacks the base from each cardinal side with the **same** army and reports how
far each assault gets. The side that falls hardest is the weakest approach — a
_measured_ result, not a heuristic — and becomes a "reinforce the X side"
recommendation with the per-side numbers as rationale. Simulation never mutates
the village, so the four probes are independent and deterministic.

## Pluggable backends (future LLM / computer vision)

`Advisor` is a one-method interface:

```ts
interface Advisor {
  id: string;
  advise(context: AdvisorContext): Recommendation[];
}
```

An `LlmAdvisor` (prompt the model with the score + weak points, parse structured
moves back) or a `VisionAdvisor` (recognize a base from a screenshot, then
delegate to the same pipeline) implements this and is passed to
`new RecommendationEngine([...createDefaultAdvisors(), myAdvisor])`. The heuristic
advisors shipping today establish the contract those backends will satisfy.

## Why this is the capstone

Everything feeds in here:

- **engine** provides the aggregate + cloning for safe what-if search;
- **analyzer** provides located weak points and the score to optimize against;
- **simulation** provides ground-truth attack outcomes.

The result is advice that is specific ("move the Town Hall to (20, 20)"),
justified ("raises the score from 41 to 58"), and directly applicable.
