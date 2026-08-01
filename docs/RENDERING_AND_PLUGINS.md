# Rendering & Plugins Guide

Phase 4 makes a village _visible_ and _portable_, and it does so through a
plugin architecture: **renderers, importers and exporters register on a
registry; core code never imports a concrete plugin.** Adding a format is a
registration, not a core edit.

## The render model (`Scene`)

Renderers do not touch the `Village` aggregate. Instead, `buildScene(village,
catalog)` (in `@clash/renderer`) flattens a village into a `Scene` — a plain,
sorted, framework-agnostic description:

```ts
interface Scene {
  grid: { width: number; height: number };
  townHall: number;
  buildings: SceneBuilding[]; // id, name, category, bounds, cells, rotation
  walls: SceneWall[]; // id, position
}
```

Output is deterministically ordered (buildings by id, walls by position), which
is what makes every renderer snapshot-testable.

`buildDocument(village, catalog)` returns `{ snapshot, scene }` — the loss-free
snapshot for structural exporters (JSON) plus the render scene for visual ones.

## 3D model (`build3DModel`)

The same `Scene` also drives the editor's 3D view. `build3DModel(scene, {
coreCategory })` (in `@clash/renderer`) flattens a `Scene` into a **plain,
three-free `Scene3DModel`** — a ground extent plus building boxes and wall
segments as pure numbers + colors (centre/size/height/color, core flagged from
`coreCategory`). It is deterministic and snapshot-tested. The view layer
(`@clash/ui`'s `EditorScene3D`) maps these descriptors to three.js meshes, so
three.js / WebGL never enters `@clash/renderer` or any core package — exactly
like the string renderers, 3D is just another consumer of the framework-agnostic
scene. See [EDITOR.md](EDITOR.md#3d-view).

## Built-in renderers (`@clash/renderer`)

| id        | Format             | Use                 | Output                                                        |
| --------- | ------------------ | ------------------- | ------------------------------------------------------------- |
| `ascii`   | `text/plain`       | Terminal blueprints | Category letters (`H`/`D`/`R`/`S`/`A`/`T`), `#` walls, legend |
| `svg`     | `image/svg+xml`    | Printing / high-res | Grid + colored rects + labels + wall tiles                    |
| `mermaid` | `text/vnd.mermaid` | Docs / diagrams     | `flowchart` with a subgraph per category                      |

```ts
import { buildScene, asciiRenderer } from "@clash/renderer";

console.log(asciiRenderer.render(buildScene(village, catalog)));
```

```
Town Hall 1 · 12x12 · 2 buildings · 2 walls
DDD.........
DDD.........
DDD.........
............
....HHHH....
....HHHH....
....HHHH....
....HHHH....
............
............
............
..##........
Legend: D=Defense  H=Town Hall  #=Wall
```

> **PNG** (retina 2× / 300 DPI) is implemented as an `AsyncExporter`:
> `createPngExporter({ renderSvg, rasterize, scale })` rasterizes the `svg`
> render behind the export contract. The exporter is environment-free — the
> pixel-pushing is an injected `Rasterizer` port, so `@clash/ui` supplies a
> browser canvas adapter today and a Node adapter (resvg) could slot in
> unchanged. See [EDITOR.md](EDITOR.md).

## The plugin registry (`@clash/plugins`)

```ts
import { PluginRegistry } from "@clash/plugins";
import { builtinRenderers } from "@clash/renderer";
import { jsonExporter, rendererExporter } from "@clash/exporter";
import { jsonImporter } from "@clash/importer";

const registry = new PluginRegistry();
for (const r of builtinRenderers) registry.registerRenderer(r);
registry.registerImporter(jsonImporter);
registry.registerExporter(jsonExporter);
registry.registerExporter(rendererExporter(/* any renderer */ builtinRenderers[1]));

registry.getRenderer("ascii")?.render(scene);
registry.getExporter("json")?.export(document, "my-base");
```

Three capability ports, all in `@clash/plugins`:

- **`Renderer`** — `render(scene) => string`. Pure and synchronous.
- **`Exporter`** — `export(document, base?) => { filename, mimeType, content }`.
- **`Importer`** — `import(text, source?) => Result<VillageSnapshot, ImportError>`.

Duplicate ids are rejected, so two plugins can't silently shadow each other.

## Import / export

- **`jsonExporter`** serializes the loss-free `snapshot` behind a versioned
  `formatVersion` wrapper (via `serializeLayout`). **`jsonImporter`** parses it
  back through `parseSaveFile` — detecting the version and **migrating old
  payloads forward** — then does structural validation (the engine re-validates
  placement when it rebuilds the `Village`). Together they round-trip a layout
  exactly, across versions — see [SAVE_FORMAT.md](SAVE_FORMAT.md) and the
  pipeline test.
- **`rendererExporter(renderer)`** turns _any_ renderer into a file exporter.
  Register a new renderer and you get a new export format for free.
- **`createGltfExporter({ coreCategory })`** exports the layout's 3D geometry as a
  self-contained **glTF 2.0** model (via `build3DModel` + `toGltf`, both pure and
  three-free). It implements the same `Exporter` port, so the editor downloads a
  `.gltf` you can open in Blender, three.js, or any glTF viewer.

## One renderer = one exporter: writing your own

```ts
import type { Renderer } from "@clash/plugins";

export const csvRenderer: Renderer = {
  id: "csv",
  kind: "renderer",
  format: "csv",
  extension: "csv",
  mimeType: "text/csv",
  render: (scene) =>
    [
      "id,def,x,y",
      ...scene.buildings.map((b) => `${b.id},${b.definitionId},${b.bounds.x},${b.bounds.y}`),
    ].join("\n"),
};

registry.registerRenderer(csvRenderer);
registry.registerExporter(rendererExporter(csvRenderer)); // .csv export, no core edits
```

## End-to-end

[`examples/pipeline`](../examples/pipeline/src/pipeline.test.ts) runs the whole
stack against the real `data/` folder: **load data → import the template →
rebuild the aggregate → validate against TH8 rules → render (ascii/svg/mermaid)
→ export JSON → re-import**, asserting the layout survives the round-trip. It is
the executable proof that the packages compose.
