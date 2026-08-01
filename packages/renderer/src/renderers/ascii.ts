import type { Renderer, Scene } from "@clash/plugins";
import { EMPTY_SYMBOL, WALL_SYMBOL, categoryLabel, categorySymbol } from "./theme.js";

function renderAscii(scene: Scene): string {
  const { width, height } = scene.grid;
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => EMPTY_SYMBOL),
  );

  const present = new Set<string>();
  for (const building of scene.buildings) {
    const symbol = categorySymbol(building.category);
    present.add(building.category);
    for (const cell of building.cells) {
      if (cell.y >= 0 && cell.y < height && cell.x >= 0 && cell.x < width) {
        grid[cell.y]![cell.x] = symbol;
      }
    }
  }
  for (const wall of scene.walls) {
    if (
      wall.position.y >= 0 &&
      wall.position.y < height &&
      wall.position.x >= 0 &&
      wall.position.x < width
    ) {
      grid[wall.position.y]![wall.position.x] = WALL_SYMBOL;
    }
  }

  const header = `${scene.tierLabel} ${scene.tier} · ${width}x${height} · ${scene.buildings.length} buildings · ${scene.walls.length} walls`;
  const body = grid.map((row) => row.join("")).join("\n");

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
