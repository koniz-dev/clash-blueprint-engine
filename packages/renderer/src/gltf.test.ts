import { InMemoryBuildingCatalog, VillageEditor, type BuildingDefinition } from "@clash/engine";
import { createSequentialIdGenerator } from "@clash/shared";
import { describe, expect, it } from "vitest";
import { buildDocument } from "./scene.js";
import { build3DModel } from "./scene3d.js";
import { createGltfExporter, toGltf } from "./gltf.js";

const DEFS: BuildingDefinition[] = [
  { id: "town_hall", name: "Town Hall", category: "townhall", width: 4, height: 4, minTier: 1 },
  { id: "cannon", name: "Cannon", category: "defense", width: 3, height: 3, minTier: 1 },
];

function sample() {
  const catalog = new InMemoryBuildingCatalog(DEFS);
  const editor = VillageEditor.forGridSize(16, catalog, 1, createSequentialIdGenerator("ent"));
  editor.addBuilding("town_hall", { x: 6, y: 6 });
  editor.addBuilding("cannon", { x: 0, y: 0 });
  editor.addWall({ x: 2, y: 2 });
  return { catalog, editor };
}

describe("toGltf", () => {
  it("emits a valid, self-contained glTF 2.0 document", () => {
    const { editor, catalog } = sample();
    const model = build3DModel(buildDocument(editor.village, catalog).scene);
    const gltf = JSON.parse(toGltf(model));

    expect(gltf.asset.version).toBe("2.0");
    // A node per box/wall + the ground slab.
    expect(gltf.nodes).toHaveLength(model.buildings.length + model.walls.length + 1);
    // Geometry is embedded as a base64 data-URI buffer (no external files).
    expect(gltf.buffers).toHaveLength(1);
    expect(gltf.buffers[0].uri).toMatch(/^data:application\/octet-stream;base64,/);
    // One material/mesh per distinct colour; every node references a real mesh.
    expect(gltf.meshes.length).toBe(gltf.materials.length);
    for (const node of gltf.nodes) {
      expect(node.mesh).toBeLessThan(gltf.meshes.length);
      expect(node.translation).toHaveLength(3);
      expect(node.scale).toHaveLength(3);
    }
    // Required POSITION accessor bounds are present.
    expect(gltf.accessors[0].min).toEqual([-0.5, -0.5, -0.5]);
    expect(gltf.accessors[0].max).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("createGltfExporter", () => {
  it("implements the Exporter port and names the file", () => {
    const { editor, catalog } = sample();
    const exporter = createGltfExporter({ coreCategory: "townhall" });
    const result = exporter.export(buildDocument(editor.village, catalog), "my-base");

    expect(exporter.kind).toBe("exporter");
    expect(result.filename).toBe("my-base.gltf");
    expect(result.mimeType).toBe("model/gltf+json");
    expect(() => JSON.parse(result.content)).not.toThrow();
  });
});
