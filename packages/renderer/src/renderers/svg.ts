import type { Renderer, Scene } from "@clash/plugins";
import { WALL_COLOR, categoryColor, categorySymbol } from "./theme.js";

const TILE = 24;
const LABEL_FONT_SIZE = Math.round(TILE * 0.7);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSvg(scene: Scene): string {
  const w = scene.grid.width * TILE;
  const h = scene.grid.height * TILE;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(scene.tierLabel)} ${scene.tier} layout">`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="#eceff1"/>`);

  // Grid lines.
  const lines: string[] = [];
  for (let x = 0; x <= scene.grid.width; x++) {
    lines.push(`<line x1="${x * TILE}" y1="0" x2="${x * TILE}" y2="${h}"/>`);
  }
  for (let y = 0; y <= scene.grid.height; y++) {
    lines.push(`<line x1="0" y1="${y * TILE}" x2="${w}" y2="${y * TILE}"/>`);
  }
  parts.push(`<g stroke="#cfd8dc" stroke-width="1">${lines.join("")}</g>`);

  // Buildings.
  for (const building of scene.buildings) {
    const bx = building.bounds.x * TILE;
    const by = building.bounds.y * TILE;
    const bw = building.bounds.width * TILE;
    const bh = building.bounds.height * TILE;
    const color = categoryColor(building.category);
    parts.push(
      `<g><title>${escapeXml(building.name)} (${building.bounds.x}, ${building.bounds.y})</title>` +
        `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${color}" fill-opacity="0.85" stroke="#263238" stroke-width="1"/>` +
        `<text x="${bx + bw / 2}" y="${by + bh / 2}" fill="#ffffff" font-family="monospace" font-size="${LABEL_FONT_SIZE}" text-anchor="middle" dominant-baseline="central">${categorySymbol(building.category)}</text>` +
        `</g>`,
    );
  }

  // Walls.
  if (scene.walls.length > 0) {
    const wallRects = scene.walls
      .map(
        (wall) =>
          `<rect x="${wall.position.x * TILE + 3}" y="${wall.position.y * TILE + 3}" width="${TILE - 6}" height="${TILE - 6}" rx="2"/>`,
      )
      .join("");
    parts.push(`<g fill="${WALL_COLOR}">${wallRects}</g>`);
  }

  parts.push("</svg>");
  return parts.join("\n");
}

/** Vector renderer suited to printing and high-resolution export. */
export const svgRenderer: Renderer = {
  id: "svg",
  kind: "renderer",
  format: "svg",
  extension: "svg",
  mimeType: "image/svg+xml",
  render: renderSvg,
};
