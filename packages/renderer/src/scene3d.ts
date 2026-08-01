import type { Scene, SceneWall } from "@clash/plugins";
import { WALL_COLOR, categoryColor } from "./renderers/theme.js";

/**
 * A framework-agnostic 3D model of a layout: plain geometry descriptors (all
 * numbers + colors, no WebGL, no three.js). A view layer maps these to meshes.
 * Coordinates are in tile units (1 tile = 1 world unit) with the grid on the
 * XZ plane and +Y up; box positions are centres, resting on the ground (y=0).
 */
export interface Box3D {
  readonly id: string;
  readonly category: string;
  /** True for the game's core/HQ building (data-designated, not a literal). */
  readonly isCore: boolean;
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly size: { readonly width: number; readonly height: number; readonly depth: number };
  readonly color: string;
  /** Footprint rotation in degrees (0/90/180/270) — for a facing marker. */
  readonly rotationDeg: number;
}

export interface WallSegment3D {
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly size: { readonly width: number; readonly height: number; readonly depth: number };
  readonly color: string;
}

export interface Scene3DModel {
  readonly ground: { readonly width: number; readonly height: number };
  readonly buildings: ReadonlyArray<Box3D>;
  readonly walls: ReadonlyArray<WallSegment3D>;
}

export interface Build3DOptions {
  /** Category designated as the core/HQ, rendered taller with an accent. */
  readonly coreCategory?: string;
}

/**
 * Flat/blocky appearance: category → box height (world units). Open set with a
 * generic fallback so any game renders sensibly. Colors come from the shared
 * renderer theme; the core building is boosted separately. No game literals
 * leak into mesh code — this one table plus `coreCategory` decide everything.
 */
const CATEGORY_HEIGHT: Readonly<Record<string, number>> = {
  townhall: 3.5,
  defense: 3,
  storage: 2.2,
  resource: 1.6,
  army: 1.8,
  trap: 0.4,
  wall: 1,
};
const DEFAULT_HEIGHT = 2;
const CORE_HEIGHT = 4;

const WALL_HEIGHT = 1.1;
const WALL_POST = 0.55; // central post extent (world units)
const WALL_THICKNESS = 0.4; // connector bar thickness

function buildingHeight(category: string, isCore: boolean): number {
  if (isCore) return CORE_HEIGHT;
  return CATEGORY_HEIGHT[category] ?? DEFAULT_HEIGHT;
}

function wallSegments(wall: SceneWall): WallSegment3D[] {
  const { x, y } = wall.position;
  const cx = x + 0.5;
  const cz = y + 0.5;
  const cy = WALL_HEIGHT / 2;
  const segments: WallSegment3D[] = [
    // Central post.
    {
      center: { x: cx, y: cy, z: cz },
      size: { width: WALL_POST, height: WALL_HEIGHT, depth: WALL_POST },
      color: WALL_COLOR,
    },
  ];
  // Connector bars reach halfway to each connected neighbour, so adjacent
  // tiles meet at the shared edge — continuous runs and corners (mirrors 2D).
  if (wall.connections.north) {
    segments.push({
      center: { x: cx, y: cy, z: y + 0.25 },
      size: { width: WALL_THICKNESS, height: WALL_HEIGHT, depth: 0.5 },
      color: WALL_COLOR,
    });
  }
  if (wall.connections.south) {
    segments.push({
      center: { x: cx, y: cy, z: y + 0.75 },
      size: { width: WALL_THICKNESS, height: WALL_HEIGHT, depth: 0.5 },
      color: WALL_COLOR,
    });
  }
  if (wall.connections.west) {
    segments.push({
      center: { x: x + 0.25, y: cy, z: cz },
      size: { width: 0.5, height: WALL_HEIGHT, depth: WALL_THICKNESS },
      color: WALL_COLOR,
    });
  }
  if (wall.connections.east) {
    segments.push({
      center: { x: x + 0.75, y: cy, z: cz },
      size: { width: 0.5, height: WALL_HEIGHT, depth: WALL_THICKNESS },
      color: WALL_COLOR,
    });
  }
  return segments;
}

/**
 * Flatten a {@link Scene} into a {@link Scene3DModel}. Pure and deterministic —
 * the same scene always yields the same descriptors, which keeps it
 * snapshot-testable and keeps three.js entirely in the view layer.
 */
export function build3DModel(scene: Scene, options: Build3DOptions = {}): Scene3DModel {
  const buildings: Box3D[] = scene.buildings.map((b): Box3D => {
    const isCore = options.coreCategory !== undefined && b.category === options.coreCategory;
    const height = buildingHeight(b.category, isCore);
    return {
      id: b.id,
      category: b.category,
      isCore,
      center: {
        x: b.bounds.x + b.bounds.width / 2,
        y: height / 2,
        z: b.bounds.y + b.bounds.height / 2,
      },
      size: { width: b.bounds.width, height, depth: b.bounds.height },
      color: categoryColor(b.category),
      rotationDeg: b.rotation,
    };
  });

  const walls: WallSegment3D[] = scene.walls.flatMap(wallSegments);

  return {
    ground: { width: scene.grid.width, height: scene.grid.height },
    buildings,
    walls,
  };
}
