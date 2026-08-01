import type { VillageSnapshot } from "@clash/engine";
import type { Result } from "@clash/shared";
import type { LayoutDocument, Scene } from "./render-model.js";

/** Discriminates the three plugin capabilities in the registry. */
export type PluginKind = "renderer" | "importer" | "exporter";

export interface Plugin {
  readonly id: string;
  readonly kind: PluginKind;
}

/**
 * Turns a {@link Scene} into a textual representation (ASCII, SVG, Mermaid…).
 * Renderers are pure and synchronous: same scene in, same string out — which is
 * exactly what makes them snapshot-testable.
 */
export interface Renderer extends Plugin {
  readonly kind: "renderer";
  readonly format: string;
  readonly extension: string;
  readonly mimeType: string;
  render(scene: Scene): string;
}

export interface ExportResult {
  readonly filename: string;
  readonly mimeType: string;
  readonly content: string;
}

/** Produces a downloadable/serializable artifact from a whole document. */
export interface Exporter extends Plugin {
  readonly kind: "exporter";
  readonly format: string;
  readonly extension: string;
  readonly mimeType: string;
  export(document: LayoutDocument, filenameBase?: string): ExportResult;
}

/**
 * Rasterizes an SVG string to a PNG data URL at a scale factor (2 = retina,
 * ~3.125 ≈ 300 DPI). Injected rather than imported, so the pure exporter never
 * depends on a browser or a native rasterizer — the adapter supplies it.
 */
export type Rasterizer = (svg: string, options: { scale: number }) => Promise<string>;

/**
 * Like {@link Exporter}, but asynchronous — for outputs that require
 * rasterization (PNG) or other async work behind the same export contract.
 */
export interface AsyncExporter extends Plugin {
  readonly kind: "exporter";
  readonly format: string;
  readonly extension: string;
  readonly mimeType: string;
  exportAsync(document: LayoutDocument, filenameBase?: string): Promise<ExportResult>;
}

export interface ImportError {
  readonly source: string;
  readonly issues: ReadonlyArray<string>;
}

/** Parses external text into a `VillageSnapshot` the engine can rebuild. */
export interface Importer extends Plugin {
  readonly kind: "importer";
  readonly format: string;
  import(text: string, source?: string): Result<VillageSnapshot, ImportError>;
}
