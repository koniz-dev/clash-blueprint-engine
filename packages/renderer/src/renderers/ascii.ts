import type { Renderer, Scene } from "@clash/plugins";
import { EMPTY_SYMBOL, WALL_SYMBOL, categoryLabel, categorySymbol } from "./theme.js";

function renderAscii(scene: Scene): string {
  const { width, height } = scene.grid;
  // Occupied cells keyed by `y * width + x`. A numeric Map key can't reach
  // Object.prototype the way a computed property write from scene data could.
  const occupied = new Map<number, string>();
  const inBounds = (x: number, y: number): boolean =>
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;

  const present = new Set<string>();
  for (const building of scene.buildings) {
    const symbol = categorySymbol(building.category);
    present.add(building.category);
    for (const cell of building.cells) {
      if (inBounds(cell.x, cell.y)) {
        occupied.set(cell.y * width + cell.x, symbol);
      }
    }
  }
  for (const wall of scene.walls) {
    const { x, y } = wall.position;
    if (inBounds(x, y)) {
      occupied.set(y * width + x, WALL_SYMBOL);
    }
  }

  const header = `${scene.tierLabel} ${scene.tier} · ${width}x${height} · ${scene.buildings.length} buildings · ${scene.walls.length} walls`;
  const body = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => occupied.get(y * width + x) ?? EMPTY_SYMBOL).join(""),
  ).join("\n");

  const legendEntries = [...present]
    .sort()
    .map((category) => `${categorySymbol(category)}=${categoryLabel(category)}`);
  if (scene.walls.length > 0) legendEntries.push(`${WALL_SYMBOL}=Wall`);
  const legend = legendEntries.length > 0 ? `\nLegend: ${legendEntries.join("  ")}` : "";

  return `${header}\n${body}${legend}\n`;
}

/** Terminal blueprint renderer. Category letters for buildings, `#` for walls. */
export const asciiRenderer: Renderer = {
  id: "ascii",
  kind: "renderer",
  format: "ascii",
  extension: "txt",
  mimeType: "text/plain",
  render: renderAscii,
};
