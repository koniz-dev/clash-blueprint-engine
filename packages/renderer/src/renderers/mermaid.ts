import type { Renderer, Scene, SceneBuilding } from "@clash/plugins";
import { categoryLabel, categoryOrder } from "./theme.js";

function nodeId(buildingId: string): string {
  return `n_${buildingId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function label(building: SceneBuilding): string {
  const safeName = building.name.replace(/"/g, "'");
  return `${safeName} (${building.bounds.x}, ${building.bounds.y})`;
}

function renderMermaid(scene: Scene): string {
  const byCategory = new Map<string, SceneBuilding[]>();
  for (const building of scene.buildings) {
    const bucket = byCategory.get(building.category);
    if (bucket) bucket.push(building);
    else byCategory.set(building.category, [building]);
  }

  // Order well-known categories first, then any game-defined ones alphabetically.
  const categories = [...byCategory.keys()].sort(
    (a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b),
  );

  const lines: string[] = ["flowchart TB"];
  for (const category of categories) {
    const buildings = byCategory.get(category);
    if (!buildings || buildings.length === 0) continue;
    lines.push(`  subgraph ${category}["${categoryLabel(category)}"]`);
    for (const building of buildings) {
      lines.push(`    ${nodeId(building.id)}["${label(building)}"]`);
    }
    lines.push("  end");
  }

  // Walls are summarized rather than drawn per-tile; closed-compartment
  // detection arrives with the wall engine and will emit compartment subgraphs.
  lines.push(`  %% walls: ${scene.walls.length}`);
  return `${lines.join("\n")}\n`;
}

/** Mermaid diagram renderer — buildings grouped into category subgraphs. */
export const mermaidRenderer: Renderer = {
  id: "mermaid",
  kind: "renderer",
  format: "mermaid",
  extension: "mmd",
  mimeType: "text/vnd.mermaid",
  render: renderMermaid,
};
