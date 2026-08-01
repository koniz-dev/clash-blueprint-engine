import type { BuildingCatalog, Village } from "@clash/engine";
import { invariant } from "@clash/shared";
import type {
  LayoutDocument,
  Scene,
  SceneBuilding,
  SceneWall,
  WallConnections,
  WallShape,
} from "@clash/plugins";

/** Classify a wall piece by its orthogonal connections (auto-connect / corners). */
export function wallShape(connections: WallConnections): WallShape {
  const count =
    Number(connections.north) +
    Number(connections.east) +
    Number(connections.south) +
    Number(connections.west);
  if (count === 0) return "isolated";
  if (count === 1) return "end";
  if (count === 4) return "cross";
  if (count === 3) return "tee";
  const straight =
    (connections.north && connections.south) || (connections.east && connections.west);
  return straight ? "straight" : "corner";
}

/**
 * Flatten a `Village` aggregate into a render model. All catalog lookups happen
 * here, once, so renderers stay free of engine internals. Output is sorted
 * deterministically (buildings by id, walls by position) so renders are stable
 * and snapshot-testable. Each wall is enriched with its neighbour connections
 * and a shape, so renderers can draw connected runs and corners.
 */
export interface SceneOptions {
  /** Per-game label for the progression axis (e.g. "Town Hall"). */
  readonly tierLabel?: string;
}

export function buildScene(
  village: Village,
  catalog: BuildingCatalog,
  options: SceneOptions = {},
): Scene {
  const buildings: SceneBuilding[] = village
    .listBuildings()
    .map((instance): SceneBuilding => {
      const def = catalog.get(instance.definitionId);
      invariant(def, `Scene build: unknown definition "${instance.definitionId}"`);
      const footprint = village.footprintOf(instance);
      return {
        id: instance.id,
        definitionId: instance.definitionId,
        name: def.name,
        category: def.category,
        bounds: footprint.bounds,
        cells: footprint.cells,
        rotation: instance.rotation,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const wallTiles = new Set(village.listWalls().map((w) => `${w.position.x},${w.position.y}`));
  const has = (x: number, y: number): boolean => wallTiles.has(`${x},${y}`);

  const walls: SceneWall[] = village
    .listWalls()
    .map((wall): SceneWall => {
      const { x, y } = wall.position;
      const connections: WallConnections = {
        north: has(x, y - 1),
        east: has(x + 1, y),
        south: has(x, y + 1),
        west: has(x - 1, y),
      };
      return { id: wall.id, position: wall.position, connections, shape: wallShape(connections) };
    })
    .sort(
      (a, b) =>
        a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
    );

  return {
    grid: { width: village.grid.width, height: village.grid.height },
    tier: village.tier,
    tierLabel: options.tierLabel ?? "Tier",
    buildings,
    walls,
  };
}

/** Build the full export document (loss-free snapshot + render-friendly scene). */
export function buildDocument(
  village: Village,
  catalog: BuildingCatalog,
  options: SceneOptions = {},
): LayoutDocument {
  return { snapshot: village.toSnapshot(), scene: buildScene(village, catalog, options) };
}
