import type { LayoutDocument } from "@clash/plugins";
import { describe, expect, it, vi } from "vitest";
import { createPngExporter, DPI_300_SCALE, RETINA_SCALE } from "./png-exporter.js";

const document: LayoutDocument = {
  snapshot: { grid: { width: 44, height: 44 }, tier: 8, buildings: [], walls: [] },
  scene: {
    grid: { width: 44, height: 44 },
    tier: 8,
    tierLabel: "Town Hall",
    buildings: [],
    walls: [],
  },
};

describe("createPngExporter", () => {
  it("renders SVG then rasterizes it at the retina scale by default", async () => {
    const renderSvg = vi.fn(() => "<svg/>");
    const rasterize = vi.fn(
      async (_svg: string, _opts: { scale: number }) => "data:image/png;base64,AAAA",
    );

    const exporter = createPngExporter({ renderSvg, rasterize });
    const result = await exporter.exportAsync(document, "base");

    expect(renderSvg).toHaveBeenCalledWith(document.scene);
    expect(rasterize).toHaveBeenCalledWith("<svg/>", { scale: RETINA_SCALE });
    expect(result).toEqual({
      filename: "base.png",
      mimeType: "image/png",
      content: "data:image/png;base64,AAAA",
    });
  });

  it("honours a custom scale (e.g. 300 DPI)", async () => {
    const rasterize = vi.fn(async () => "data:image/png;base64,BBBB");
    const exporter = createPngExporter({
      renderSvg: () => "<svg/>",
      rasterize,
      scale: DPI_300_SCALE,
    });
    await exporter.exportAsync(document);
    expect(rasterize).toHaveBeenCalledWith("<svg/>", { scale: DPI_300_SCALE });
  });
});
