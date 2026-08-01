import { useMemo, useState } from "react";
import type { BuildingCatalog, BuildingDefinition } from "@clash/engine";
import { categoryColor, categoryOrder } from "@clash/renderer";
import { categoryMessageKey, useI18n } from "./i18n";
import type { EditorController } from "./useEditor";

export function BuildingLibrary({
  controller,
  catalog,
}: {
  controller: EditorController;
  catalog: BuildingCatalog;
}): JSX.Element {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (def: BuildingDefinition): boolean =>
      needle === "" ||
      def.name.toLowerCase().includes(needle) ||
      def.category.toLowerCase().includes(needle);

    const map = new Map<string, BuildingDefinition[]>();
    for (const def of catalog.all()) {
      if (!matches(def)) continue;
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return map;
  }, [catalog, query]);

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
      <h2 className="cbe-panel-title">{t("panel.buildings")}</h2>
      <input
        className="cbe-lib-search"
        type="search"
        placeholder={t("library.search")}
        aria-label={t("library.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {categories.length === 0 && <p className="cbe-muted">{t("library.noMatch", { query })}</p>}
      {categories.map((category) => {
        const catKey = categoryMessageKey(category);
        return (
          <div key={category} className="cbe-lib-group">
            <div className="cbe-lib-category">{catKey ? t(catKey) : category}</div>
            <div className="cbe-lib-grid">
              {(grouped.get(category) ?? []).map((def) => {
                const active =
                  controller.placingDefinitionId === def.id && controller.tool === "place";
                // Live rule status: count vs. allowance + unlock (advisory only).
                const status = controller.liveValidation.perDefinition.get(def.id);
                const locked = status ? !status.unlocked : false;
                const atMax = status?.atMax ?? false;
                const showCount = status?.allowed === true && status.max !== null;
                const stateClass = locked ? "cbe-lib-item-locked" : atMax ? "cbe-lib-item-max" : "";
                const stateHint = locked
                  ? ` · ${t("library.locked")}`
                  : atMax
                    ? ` · ${t("library.atMax")}`
                    : "";
                return (
                  <button
                    key={def.id}
                    className={`cbe-lib-item ${active ? "cbe-lib-item-active" : ""} ${stateClass}`}
                    onClick={() => choose(def.id)}
                    title={`${def.name} — ${def.width}×${def.height}, TH${def.minTier}${stateHint}`}
                  >
                    <span
                      className="cbe-lib-swatch"
                      style={{ background: categoryColor(def.category) }}
                    />
                    <span className="cbe-lib-name">{def.name}</span>
                    {locked && (
                      <span className="cbe-lib-lock" aria-hidden="true" title={t("library.locked")}>
                        🔒
                      </span>
                    )}
                    {showCount ? (
                      <span className={`cbe-lib-count ${atMax ? "cbe-lib-count-max" : ""}`}>
                        {t("library.count", { count: status!.count, max: status!.max! })}
                      </span>
                    ) : (
                      <span className="cbe-lib-size">
                        {def.width}×{def.height}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
