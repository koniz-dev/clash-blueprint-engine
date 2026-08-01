import { useMemo } from "react";
import type { BuildingCatalog, BuildingDefinition } from "@clash/engine";
import { categoryColor, categoryOrder } from "@clash/renderer";
import type { EditorController } from "./useEditor";

export function BuildingLibrary({
  controller,
  catalog,
}: {
  controller: EditorController;
  catalog: BuildingCatalog;
}): JSX.Element {
  const grouped = useMemo(() => {
    const map = new Map<string, BuildingDefinition[]>();
    for (const def of catalog.all()) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return map;
  }, [catalog]);

  // Well-known categories first, then any game-defined ones alphabetically.
  const categories = [...grouped.keys()].sort(
    (a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b),
  );

  const choose = (definitionId: string): void => {
    controller.setPlacingDefinitionId(definitionId);
    controller.setTool("place");
  };

  return (
    <div className="cbe-panel">
      <h2 className="cbe-panel-title">Buildings</h2>
      {categories.map((category) => (
        <div key={category} className="cbe-lib-group">
          <div className="cbe-lib-category">{category}</div>
          <div className="cbe-lib-grid">
            {(grouped.get(category) ?? []).map((def) => {
              const active =
                controller.placingDefinitionId === def.id && controller.tool === "place";
              return (
                <button
                  key={def.id}
                  className={`cbe-lib-item ${active ? "cbe-lib-item-active" : ""}`}
                  onClick={() => choose(def.id)}
                  title={`${def.name} — ${def.width}×${def.height}, TH${def.minTier}`}
                >
                  <span
                    className="cbe-lib-swatch"
                    style={{ background: categoryColor(def.category) }}
                  />
                  <span className="cbe-lib-name">{def.name}</span>
                  <span className="cbe-lib-size">
                    {def.width}×{def.height}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
