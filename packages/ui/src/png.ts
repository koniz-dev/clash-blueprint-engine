import type { Rasterizer } from "@clash/plugins";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load SVG for rasterization"));
    image.src = url;
  });
}

/**
 * Browser {@link Rasterizer}: draws an SVG onto a scaled 2D canvas and returns a
 * PNG data URL. Scale ≥ 1 gives retina / print resolution. This is the DOM
 * adapter for the pure `createPngExporter` — the exporter stays environment-free.
 */
export const rasterizeSvgToPng: Rasterizer = async (svg, { scale }) => {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const width = Math.max(1, Math.round((image.width || 512) * scale));
    const height = Math.max(1, Math.round((image.height || 512) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
};
