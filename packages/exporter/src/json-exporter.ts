import { serializeLayout, type Exporter } from "@clash/plugins";

/**
 * Loss-free blueprint export. Serializes the document's `snapshot` (not the
 * render scene) behind a versioned `formatVersion` wrapper so a re-import can
 * migrate it forward. Pairs with the JSON importer for a round-trip.
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
      content: serializeLayout(document.snapshot),
    };
  },
};
