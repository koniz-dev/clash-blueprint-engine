import { createSequentialIdGenerator } from "@clash/shared";
import { bench, describe } from "vitest";
import { InMemoryBuildingCatalog, VillageEditor } from "./index.js";

const catalog = new InMemoryBuildingCatalog([
  { id: "unit", name: "Unit", category: "defense", width: 1, height: 1, minTier: 1 },
  { id: "big", name: "Big", category: "defense", width: 3, height: 3, minTier: 1 },
]);

function packedVillage(target: number): VillageEditor {
  const editor = VillageEditor.forGridSize(48, catalog, 1, createSequentialIdGenerator("b"));
  let placed = 0;
  for (let y = 0; y < 48 && placed < target; y++) {
    for (let x = 0; x < 48 && placed < target; x++) {
      if (editor.addBuilding("unit", { x, y }).ok) placed++;
    }
  }
  return editor;
}

describe("spatial index", () => {
  bench("place 1000 buildings on a 48×48 grid", () => {
    packedVillage(1000);
  });

  bench("100k occupancy queries on a full grid", () => {
    const editor = packedVillage(1000);
    for (let i = 0; i < 100_000; i++) {
      editor.village.occupantAt({ x: i % 48, y: (i >> 6) % 48 });
    }
  });
});

describe("overlap checks", () => {
  bench("1000 overlap-rejected placements (3×3)", () => {
    const editor = VillageEditor.forGridSize(48, catalog, 1, createSequentialIdGenerator("o"));
    editor.addBuilding("big", { x: 10, y: 10 });
    for (let i = 0; i < 1000; i++) {
      editor.addBuilding("big", { x: 11, y: 11 }); // always overlaps → rejected
    }
  });
});
