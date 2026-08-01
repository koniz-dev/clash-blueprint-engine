import type { Exporter } from "@clash/plugins";
import { build3DModel, type Box3D, type Scene3DModel, type WallSegment3D } from "./scene3d.js";

/**
 * Serialize a {@link Scene3DModel} to a self-contained **glTF 2.0** JSON string
 * (geometry + colors embedded as a base64 data-URI buffer). Pure and
 * framework-free — no three.js, no browser APIs — so the same output is produced
 * on web, CLI or tests. Each box/wall is a node instancing one shared unit cube,
 * transformed by TRS and coloured by a per-material `baseColorFactor`.
 */
export function toGltf(model: Scene3DModel): string {
  // Shared unit cube (centre at origin, edge length 1).
  const positions = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  ]);
  // prettier-ignore
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, // front
    4, 6, 5, 4, 7, 6, // back
    0, 3, 7, 0, 7, 4, // left
    1, 5, 6, 1, 6, 2, // right
    3, 2, 6, 3, 6, 7, // top
    0, 4, 5, 0, 5, 1, // bottom
  ]);

  const posBytes = positions.byteLength; // 96
  const buffer = new Uint8Array(posBytes + indices.byteLength);
  buffer.set(new Uint8Array(positions.buffer), 0);
  buffer.set(new Uint8Array(indices.buffer), posBytes);

  // One material + one mesh per distinct colour; nodes reuse them via TRS.
  const materialIndexByColor = new Map<string, number>();
  const materials: unknown[] = [];
  const meshes: unknown[] = [];
  const materialFor = (color: string): number => {
    const existing = materialIndexByColor.get(color);
    if (existing !== undefined) return existing;
    const index = materials.length;
    materials.push({
      name: color,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [...hexToLinearRgb(color), 1],
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    });
    meshes.push({
      primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: index }],
    });
    materialIndexByColor.set(color, index);
    return index;
  };

  const nodes: unknown[] = [];
  const boxNode = (item: Box3D | WallSegment3D, name: string, rotationDeg = 0): void => {
    const node: Record<string, unknown> = {
      name,
      mesh: materialFor(item.color),
      translation: [item.center.x, item.center.y, item.center.z],
      scale: [item.size.width, item.size.height, item.size.depth],
    };
    if (rotationDeg !== 0) {
      // Match the 3D view's `[0, -deg, 0]` Y-euler as a quaternion.
      const a = (-rotationDeg * Math.PI) / 180;
      node.rotation = [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
    }
    nodes.push(node);
  };

  // A thin ground slab for context (sits just below y=0).
  nodes.push({
    name: "ground",
    mesh: materialFor("#26323c"),
    translation: [model.ground.width / 2, -0.05, model.ground.height / 2],
    scale: [model.ground.width, 0.1, model.ground.height],
  });
  model.buildings.forEach((b) => boxNode(b, `building:${b.id}`, b.rotationDeg));
  model.walls.forEach((w, i) => boxNode(w, `wall:${i}`));

  const gltf = {
    asset: { version: "2.0", generator: "clash-blueprint-engine" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: 8,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      {
        bufferView: 1,
        componentType: 5123 /* UNSIGNED_SHORT */,
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 /* ARRAY_BUFFER */ },
      {
        buffer: 0,
        byteOffset: posBytes,
        byteLength: indices.byteLength,
        target: 34963 /* ELEMENT_ARRAY_BUFFER */,
      },
    ],
    buffers: [
      { byteLength: buffer.length, uri: `data:application/octet-stream;base64,${base64(buffer)}` },
    ],
  };

  return JSON.stringify(gltf);
}

/**
 * An {@link Exporter} that downloads the layout's 3D geometry as glTF. Reuses
 * {@link build3DModel} so it stays consistent with the editor's 3D view.
 */
export function createGltfExporter(options: { coreCategory?: string } = {}): Exporter {
  return {
    id: "gltf",
    kind: "exporter",
    format: "gltf",
    extension: "gltf",
    mimeType: "model/gltf+json",
    export(document, filenameBase = "layout") {
      const model = build3DModel(
        document.scene,
        options.coreCategory !== undefined ? { coreCategory: options.coreCategory } : {},
      );
      return {
        filename: `${filenameBase}.gltf`,
        mimeType: "model/gltf+json",
        content: toGltf(model),
      };
    },
  };
}

// --- helpers ---------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64-encode bytes without Node's Buffer or the browser's btoa. */
function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

/** `#rrggbb` → linear-space RGB triple in 0..1 (glTF baseColorFactor is linear). */
function hexToLinearRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const to = (h: string): number => {
    const srgb = parseInt(h, 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return [to(clean.slice(0, 2)), to(clean.slice(2, 4)), to(clean.slice(4, 6))];
}
