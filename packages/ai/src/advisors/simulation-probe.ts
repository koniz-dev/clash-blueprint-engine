import type { AttackProbe } from "../types.js";
import type { Advisor, Recommendation, RecommendationPriority } from "../types.js";

function weakestProbe(probes: ReadonlyArray<AttackProbe>): AttackProbe | undefined {
  let worst: AttackProbe | undefined;
  for (const probe of probes) {
    if (
      !worst ||
      probe.destructionPercent > worst.destructionPercent ||
      (probe.destructionPercent === worst.destructionPercent && probe.stars > worst.stars)
    ) {
      worst = probe;
    }
  }
  return worst;
}

function priorityFor(destructionPercent: number): RecommendationPriority {
  if (destructionPercent >= 70) return "high";
  if (destructionPercent >= 40) return "medium";
  return "low";
}

/**
 * Reads the directional attack probes and recommends reinforcing the side that
 * fell hardest. Unlike the static advisors, its evidence is a *measured*
 * outcome — the same army got further from this direction than any other — which
 * is exactly the kind of signal a defender can act on with confidence.
 */
export const simulationProbeAdvisor: Advisor = {
  id: "simulation-probe",
  advise(context): Recommendation[] {
    const probes = context.probes;
    if (probes.length === 0) return [];

    const weakest = weakestProbe(probes);
    if (!weakest) return [];

    // Nothing meaningful to say if every side is equally (and lightly) hit.
    const best = probes.reduce((a, b) => (b.destructionPercent < a.destructionPercent ? b : a));
    const spread = weakest.destructionPercent - best.destructionPercent;
    if (weakest.destructionPercent < 25 && spread < 15) return [];

    const summary = probes.map((p) => `${p.direction} ${p.destructionPercent}%`).join(", ");

    return [
      {
        id: "simulation-probe-1",
        advisorId: this.id,
        category: "defense-placement",
        priority: priorityFor(weakest.destructionPercent),
        title: `Reinforce the ${weakest.direction} approach`,
        detail: `An identical army sent from the ${weakest.direction} destroyed ${weakest.destructionPercent}% of the base${weakest.coreDestroyed ? " (including the core building)" : ""}. Add or reposition defenses to cover that lane.`,
        rationale: `Attack probes by side — ${summary}. The ${weakest.direction} side is the weakest.`,
        action: { type: "addBuilding", category: "defense", near: weakest.deployment },
      },
    ];
  },
};
