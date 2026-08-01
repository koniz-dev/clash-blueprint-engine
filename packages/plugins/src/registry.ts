import { invariant } from "@clash/shared";
import type { Exporter, Importer, Renderer } from "./ports.js";

/**
 * The extension point of the whole system. Renderers, importers and exporters
 * register here by id; core code never imports concrete plugins, so adding a
 * capability is a registration call, not a core edit.
 *
 * ```ts
 * const registry = new PluginRegistry();
 * registry.registerRenderer(asciiRenderer);
 * registry.getRenderer("ascii")?.render(scene);
 * ```
 */
export class PluginRegistry {
  readonly #renderers = new Map<string, Renderer>();
  readonly #importers = new Map<string, Importer>();
  readonly #exporters = new Map<string, Exporter>();

  registerRenderer(renderer: Renderer): this {
    invariant(!this.#renderers.has(renderer.id), `Renderer "${renderer.id}" already registered`);
    this.#renderers.set(renderer.id, renderer);
    return this;
  }

  registerImporter(importer: Importer): this {
    invariant(!this.#importers.has(importer.id), `Importer "${importer.id}" already registered`);
    this.#importers.set(importer.id, importer);
    return this;
  }

  registerExporter(exporter: Exporter): this {
    invariant(!this.#exporters.has(exporter.id), `Exporter "${exporter.id}" already registered`);
    this.#exporters.set(exporter.id, exporter);
    return this;
  }

  getRenderer(id: string): Renderer | undefined {
    return this.#renderers.get(id);
  }

  getImporter(id: string): Importer | undefined {
    return this.#importers.get(id);
  }

  getExporter(id: string): Exporter | undefined {
    return this.#exporters.get(id);
  }

  renderers(): ReadonlyArray<Renderer> {
    return [...this.#renderers.values()];
  }

  importers(): ReadonlyArray<Importer> {
    return [...this.#importers.values()];
  }

  exporters(): ReadonlyArray<Exporter> {
    return [...this.#exporters.values()];
  }
}
