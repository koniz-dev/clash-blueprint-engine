import { useEffect, useState } from "react";
import type { BuildingCatalog, GameRules, Village, VillageEditor } from "@clash/engine";
import type { GridVec } from "@clash/shared";
import { buildAnalysisContext } from "@clash/analyzer";

/** One walled compartment as renderable geometry + a distinct fill colour. */
export interface OverlayCompartment {
  readonly tiles: ReadonlyArray<GridVec>;
  readonly color: string;
  readonly isDeadZone: boolean;
}

/** Renderable geometry for the three defensive overlays. Pure numbers/tiles. */
export interface OverlayData {
  /** Tiles within range of at least one defensive building. */
  readonly coverageTiles: ReadonlyArray<GridVec>;
  /** Every walled compartment, coloured for the compartments overlay. */
  readonly compartments: ReadonlyArray<OverlayCompartment>;
  /** Tiles of enclosed-but-empty compartments (walls protecting nothing). */
  readonly deadZoneTiles: ReadonlyArray<GridVec>;
}

const EMPTY: OverlayData = { coverageTiles: [], compartments: [], deadZoneTiles: [] };

/**
 * Cool-hue translucent palette for compartments — deliberately avoids the rule
 * red/amber, weak-point violet and selection yellow so the per-building cues stay
 * readable on top.
 */
const COMPARTMENT_PALETTE = [
  "#2dd4bf",
  "#4f9cf9",
  "#6366f1",
  "#22d3ee",
  "#94a3b8",
  "#38bdf8",
] as const;

/**
 * Pure derivation of the defensive-overlay geometry from the current village. No
 * React, no debounce — just renderable tiles/regions, so it is trivially
 * testable. Reuses the analyzer's pure `buildAnalysisContext` (defenses +
 * compartments) and derives coverage the same way the analyzer's own `isCovered`
 * does (a tile centre within a defense's Euclidean range).
 */
export function deriveOverlays(
  village: Village,
  catalog: BuildingCatalog,
  rules: GameRules,
): OverlayData {
  if (village.buildingCount === 0 && village.wallCount === 0) return EMPTY;

  const ctx = buildAnalysisContext(village, catalog, rules);

  // Coverage: a tile is covered if its centre is within any defense's range.
  const coverageTiles: GridVec[] = [];
  if (ctx.defenses.length > 0) {
    const { width, height } = village.grid;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        for (const d of ctx.defenses) {
          if (Math.hypot(d.center.x - cx, d.center.y - cy) <= d.range) {
            coverageTiles.push({ x, y });
            break;
          }
        }
      }
    }
  }

  const compartments: OverlayCompartment[] = ctx.compartments.compartments.map((c, i) => ({
    tiles: c.tiles,
    color: COMPARTMENT_PALETTE[i % COMPARTMENT_PALETTE.length]!,
    isDeadZone: c.isDeadZone,
  }));
  const deadZoneTiles: GridVec[] = compartments
    .filter((c) => c.isDeadZone)
    .flatMap((c) => [...c.tiles]);

  return { coverageTiles, compartments, deadZoneTiles };
}

/**
 * Reactive, debounced overlay geometry. Mirrors {@link useLiveAnalysis}:
 * recomputes ~200ms after each `version` bump (coalescing the Wall tool's
 * per-tile bursts). Gated on `active` — while every overlay is off (the default)
 * it does no work at all. A thin projection; it never mutates anything.
 */
export function useOverlays(
  editor: VillageEditor,
  catalog: BuildingCatalog,
  rules: GameRules,
  version: number,
  active: boolean,
): OverlayData {
  const [state, setState] = useState<OverlayData>(() =>
    active ? deriveOverlays(editor.village, catalog, rules) : EMPTY,
  );

  useEffect(() => {
    if (!active) {
      setState(EMPTY);
      return;
    }
    const id = setTimeout(() => {
      setState(deriveOverlays(editor.village, catalog, rules));
    }, 200);
    return () => clearTimeout(id);
  }, [editor, catalog, rules, version, active]);

  return state;
}
