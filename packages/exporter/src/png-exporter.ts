import type { AsyncExporter, Rasterizer, Scene } from "@clash/plugins";

/** ≈ 300 DPI relative to the 96 DPI CSS baseline — for print-quality export. */
export const DPI_300_SCALE = 300 / 96;
/** Retina / 2× export. */
export const RETINA_SCALE = 2;

export interface PngExporterOptions {
  /** SVG renderer used as the rasterization source (e.g. `svgRenderer.render`). */
  readonly renderSvg: (scene: Scene) => string;
  /** Adapter that turns the SVG into a PNG data URL (browser canvas, resvg, …). */
  readonly rasterize: Rasterizer;
  /** Output scale factor. Default 2 (retina). Use {@link DPI_300_SCALE} for print. */
  readonly scale?: number;
}

/**
 * PNG exporter — the SVG render is rasterized behind the standard exporter
 * contract. The exporter itself is pure and environment-free; the actual
 * pixel-pushing is the injected {@link Rasterizer}, so this same factory works
 * with a browser canvas today and a Node rasterizer (resvg) tomorrow.
 */
export function createPngExporter(options: PngExporterOptions): AsyncExporter {
  const scale = options.scale ?? RETINA_SCALE;
  return {
    id: "png",
    kind: "exporter",
    format: "png",
    extension: "png",
    mimeType: "image/png",
    async exportAsync(document, filenameBase = "layout") {
      const svg = options.renderSvg(document.scene);
      const content = await options.rasterize(svg, { scale });
      return { filename: `${filenameBase}.png`, mimeType: "image/png", content };
    },
  };
}
