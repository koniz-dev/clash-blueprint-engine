import type { Exporter } from "@clash/plugins";

/**
 * Loss-free blueprint export. Serializes the document's `snapshot` (not the
 * render scene) so a re-import reconstructs the exact village. Pairs with the
 * JSON importer for a round-trip.
 */
export const jsonExporter: Exporter = {
  id: "json",
  kind: "exporter",
  format: "json",
  extension: "json",
  mimeType: "application/json",
  export(document, filenameBase = "layout") {
    return {
      filename: `${filenameBase}.json`,
      mimeType: "application/json",
      content: `${JSON.stringify(document.snapshot, null, 2)}\n`,
    };
  },
};
