import type { Exporter, Renderer } from "@clash/plugins";

/**
 * Adapt any {@link Renderer} into an {@link Exporter} — the render output
 * becomes the file content. This is why registering a new renderer
 * automatically yields a new export format, with no exporter code to write.
 */
export function rendererExporter(renderer: Renderer): Exporter {
  return {
    id: `${renderer.id}-export`,
    kind: "exporter",
    format: renderer.format,
    extension: renderer.extension,
    mimeType: renderer.mimeType,
    export(document, filenameBase = "layout") {
      return {
        filename: `${filenameBase}.${renderer.extension}`,
        mimeType: renderer.mimeType,
        content: renderer.render(document.scene),
      };
    },
  };
}
