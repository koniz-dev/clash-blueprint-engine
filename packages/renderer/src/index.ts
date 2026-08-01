export { buildScene, buildDocument, wallShape, type SceneOptions } from "./scene.js";
export {
  build3DModel,
  type Scene3DModel,
  type Box3D,
  type WallSegment3D,
  type Build3DOptions,
} from "./scene3d.js";
export { toGltf, createGltfExporter } from "./gltf.js";
export { asciiRenderer } from "./renderers/ascii.js";
export { svgRenderer } from "./renderers/svg.js";
export { mermaidRenderer } from "./renderers/mermaid.js";
export {
  categoryColor,
  categorySymbol,
  categoryLabel,
  categoryOrder,
  EMPTY_SYMBOL,
  WALL_SYMBOL,
  WALL_COLOR,
} from "./renderers/theme.js";

import { asciiRenderer } from "./renderers/ascii.js";
import { mermaidRenderer } from "./renderers/mermaid.js";
import { svgRenderer } from "./renderers/svg.js";

/** All built-in renderers, ready to register on a `PluginRegistry`. */
export const builtinRenderers = [asciiRenderer, svgRenderer, mermaidRenderer] as const;
