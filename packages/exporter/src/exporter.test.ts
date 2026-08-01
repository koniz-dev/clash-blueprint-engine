import { CURRENT_SAVE_VERSION, type LayoutDocument, type Renderer } from "@clash/plugins";
import { describe, expect, it } from "vitest";
import { jsonExporter } from "./json-exporter.js";
import { rendererExporter } from "./renderer-exporter.js";

const document: LayoutDocument = {
  snapshot: {
    grid: { width: 44, height: 44 },
    tier: 8,
    buildings: [
      {
        id: "b1" as never,
        definitionId: "cannon",
        position: { x: 10, y: 10 },
        rotation: 0,
      },
    ],
    walls: [],
  },
  scene: {
    grid: { width: 44, height: 44 },
    tier: 8,
    tierLabel: "Town Hall",
    buildings: [
      {
        id: "b1",
        definitionId: "cannon",
        name: "Cannon",
        category: "defense",
        bounds: { x: 10, y: 10, width: 3, height: 3 },
        cells: [{ x: 10, y: 10 }],
        rotation: 0,
      },
    ],
    walls: [],
  },
};

describe("jsonExporter", () => {
  it("serializes the loss-free snapshot behind a version wrapper", () => {
    const result = jsonExporter.export(document, "my-base");
    expect(result.filename).toBe("my-base.json");
    expect(result.mimeType).toBe("application/json");
    expect(JSON.parse(result.content)).toEqual({
      formatVersion: CURRENT_SAVE_VERSION,
      snapshot: document.snapshot,
    });
  });
});

describe("rendererExporter", () => {
  it("adapts a renderer into a file exporter using its metadata", () => {
    const fakeRenderer: Renderer = {
      id: "ascii",
      kind: "renderer",
      format: "ascii",
      extension: "txt",
      mimeType: "text/plain",
      render: (scene) => `buildings:${scene.buildings.length}`,
    };
    const exporter = rendererExporter(fakeRenderer);
    const result = exporter.export(document, "layout");
    expect(exporter.id).toBe("ascii-export");
    expect(result.filename).toBe("layout.txt");
    expect(result.content).toBe("buildings:1");
  });
});
