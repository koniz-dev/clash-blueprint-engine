import { useCallback, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GAME_RULES,
  VillageEditor,
  describeEngineError,
  rotateClockwise,
  type BuildingCatalog,
  type GameRules,
  type Rotation,
  type VillageSnapshot,
} from "@clash/engine";
import { brand, type GridVec } from "@clash/shared";
import {
  asciiRenderer,
  buildDocument,
  buildScene,
  createGltfExporter,
  svgRenderer,
} from "@clash/renderer";
import { createPngExporter, jsonExporter, rendererExporter } from "@clash/exporter";
import { jsonImporter } from "@clash/importer";
import type { RuleSet } from "@clash/rules-engine";
import type { ExportResult, Scene } from "@clash/plugins";
import { rasterizeSvgToPng } from "./png";
import type { ShortcutContext } from "./shortcuts";
import { useLog } from "./hooks/useLog";
import { useEngineBinding } from "./hooks/useEngineBinding";
import { useSelection } from "./hooks/useSelection";
import { useClipboard } from "./hooks/useClipboard";
import { useQueries, type AnalyzeAsync } from "./hooks/useQueries";
import { useLiveValidation } from "./hooks/useLiveValidation";
import { useLiveAnalysis } from "./hooks/useLiveAnalysis";
import { useReplay } from "./hooks/useReplay";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePersistence } from "./hooks/usePersistence";
import { useHelp } from "./hooks/useHelp";
import { useDiscardGuard } from "./hooks/useDiscardGuard";

export type Tool = "select" | "place" | "wall" | "delete" | "hand";

/** Which view renders the layout: the 2D Konva canvas or the 3D three.js scene. */
export type ViewMode = "2d" | "3d";

/** A bundled starter layout the user can open from the toolbar's gallery. */
export interface EditorTemplate {
  readonly id: string;
  readonly name: string;
  readonly snapshot: VillageSnapshot;
}

export interface UseEditorOptions {
  readonly catalog: BuildingCatalog;
  readonly ruleSet?: RuleSet;
  readonly gridSize?: number;
  readonly tier?: number;
  /** Per-game label for the progression axis; defaults to `rules.tierLabel`. */
  readonly tierLabel?: string;
  /** Game-specific rules (core category, roles, HP…). Defaults to Clash-like. */
  readonly rules?: GameRules;
  /** If provided, AI recommendations run here (off the main thread). */
  readonly analyzeAsync?: AnalyzeAsync;
  /** Layouts offered in the "Open" gallery. */
  readonly templates?: readonly EditorTemplate[];
  /**
   * localStorage key for autosave/restore. When set, the layout is saved on
   * every change and restored on next load. Omit to disable persistence.
   */
  readonly persistKey?: string;
}

/**
 * The React ⇆ engine binding. It owns a single {@link VillageEditor} and
 * composes focused hooks — selection, clipboard, queries, replay, keyboard,
 * persistence, help — into one controller. Every mutation goes through the
 * editor facade: this hook contains **no game rules**, it only dispatches
 * commands and reflects engine state back to React.
 */
export function useEditor(options: UseEditorOptions) {
  const { catalog, ruleSet, analyzeAsync } = options;
  const rules = options.rules ?? DEFAULT_GAME_RULES;
  const tierLabel = options.tierLabel ?? rules.tierLabel;

  const editorRef = useRef<VillageEditor | null>(null);
  if (editorRef.current === null) {
    editorRef.current = VillageEditor.forGridSize(
      options.gridSize ?? 44,
      catalog,
      options.tier ?? 1,
    );
  }
  const editor = editorRef.current;

  const { log, pushLog } = useLog();
  const { version, bump, rebind } = useEngineBinding(editor, pushLog);

  const scene: Scene = useMemo(
    () => buildScene(editor.village, catalog, { tierLabel }),
    // `version` bumps on every command/event, which is the signal that the
    // aggregate (mutated in place) changed. It is intentionally the memo key even
    // though it isn't read in the body — that's why exhaustive-deps is disabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, catalog, tierLabel, version],
  );

  // --- UI tool state ------------------------------------------------------
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [placingDefinitionId, setPlacingDefinitionId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);

  // --- Composed hooks -----------------------------------------------------
  const selection = useSelection(editor, scene);
  const { selectedIds, selectedId, setSelectedIds, partitionSelection } = selection;
  const clipboard = useClipboard(editor, selectedIds, setSelectedIds, pushLog);
  const queries = useQueries(editor, catalog, rules, ruleSet, analyzeAsync, pushLog);
  // Reactive rule feedback derived from the pure validator on every change.
  const liveValidation = useLiveValidation(editor, catalog, rules, ruleSet, version);
  // Reactive defense score derived from the pure analyzer (heavier → longer debounce).
  const liveAnalysis = useLiveAnalysis(editor, catalog, rules, version);
  const replay = useReplay(editor, catalog, rules, pushLog);
  const help = useHelp(options.persistKey);
  const guard = useDiscardGuard(editor);

  // --- Commands (all delegate to the facade) ------------------------------

  const placeBuilding = useCallback(
    (position: GridVec) => {
      if (!placingDefinitionId) return;
      const result = editor.addBuilding(placingDefinitionId, position, rotation);
      if (!result.ok) pushLog("error", describeEngineError(result.error));
    },
    [editor, placingDefinitionId, rotation, pushLog],
  );

  const addWall = useCallback(
    (position: GridVec) => {
      const result = editor.addWall(position);
      if (!result.ok && result.error.kind !== "OVERLAP") {
        pushLog("error", describeEngineError(result.error));
      }
    },
    [editor, pushLog],
  );

  const deleteAt = useCallback(
    (position: GridVec) => {
      const occupant = editor.village.occupantAt(position);
      if (!occupant) return;
      if (editor.village.getBuilding(brand<"Building">(occupant))) {
        editor.removeBuilding(brand<"Building">(occupant));
        setSelectedIds((prev) => prev.filter((id) => id !== occupant));
      } else if (editor.village.getWall(brand<"Wall">(occupant))) {
        editor.removeWall(brand<"Wall">(occupant));
      }
    },
    [editor, setSelectedIds],
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const { buildingIds, wallIds } = partitionSelection();
    const result = editor.removeEntities(buildingIds, wallIds);
    if (!result.ok) pushLog("error", describeEngineError(result.error));
    setSelectedIds([]);
  }, [editor, selectedIds, partitionSelection, setSelectedIds, pushLog]);

  /**
   * Translate the selection (buildings and walls) by a tile delta as one atomic,
   * undoable gesture (drag-to-move, arrow-key nudge). A zero delta is a no-op.
   */
  const moveSelectedBy = useCallback(
    (dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      const { buildingIds, wallIds } = partitionSelection();
      const buildingMoves = buildingIds.flatMap((id) => {
        const b = editor.village.getBuilding(id);
        return b ? [{ id, to: { x: b.position.x + dx, y: b.position.y + dy } }] : [];
      });
      const wallMoves = wallIds.flatMap((id) => {
        const w = editor.village.getWall(id);
        return w ? [{ id, to: { x: w.position.x + dx, y: w.position.y + dy } }] : [];
      });
      if (buildingMoves.length === 0 && wallMoves.length === 0) return;
      const result = editor.moveEntities(buildingMoves, wallMoves);
      if (!result.ok) pushLog("error", describeEngineError(result.error));
    },
    [editor, partitionSelection, pushLog],
  );

  const rotateSelected = useCallback(() => {
    if (!selectedId) return;
    const current = editor.village.getBuilding(brand<"Building">(selectedId));
    if (!current) return;
    const result = editor.rotateBuilding(
      brand<"Building">(selectedId),
      rotateClockwise(current.rotation),
    );
    if (!result.ok) pushLog("error", describeEngineError(result.error));
  }, [editor, selectedId, pushLog]);

  const moveSelected = useCallback(
    (to: GridVec) => {
      if (!selectedId) return;
      const result = editor.moveBuilding(brand<"Building">(selectedId), to);
      if (!result.ok) pushLog("error", describeEngineError(result.error));
    },
    [editor, selectedId, pushLog],
  );

  const applyMove = useCallback(
    (buildingId: string, to: GridVec) => {
      const result = editor.moveBuilding(brand<"Building">(buildingId), to);
      if (result.ok) pushLog("info", "Applied AI move suggestion");
      else pushLog("error", describeEngineError(result.error));
    },
    [editor, pushLog],
  );

  const undo = useCallback(() => editor.undo(), [editor]);
  const redo = useCallback(() => editor.redo(), [editor]);

  /** Step through history: negative = undo N times, positive = redo N times. */
  const jumpHistory = useCallback(
    (steps: number) => {
      for (let i = 0; i < -steps; i += 1) editor.undo();
      for (let i = 0; i < steps; i += 1) editor.redo();
    },
    [editor],
  );

  // --- Load / import orchestration ----------------------------------------

  // Called after `editor.load`: re-bind subscriptions to the new stores, rebuild
  // the scene, and clear stale panel/selection state.
  const afterLoad = useCallback(() => {
    rebind();
    bump();
    selection.clearSelection();
    queries.reset();
  }, [rebind, bump, selection, queries]);

  const resetNow = useCallback(() => {
    editor.load({
      grid: editor.village.grid.toJSON(),
      tier: editor.village.tier,
      buildings: [],
      walls: [],
    });
    afterLoad();
    pushLog("info", "New layout");
  }, [editor, afterLoad, pushLog]);
  const reset = useCallback(() => guard.guardDiscard("discard.new", resetNow), [guard, resetNow]);

  /** Replace the whole layout with a loaded snapshot (import / template / restore). */
  const importSnapshot = useCallback(
    (snapshot: VillageSnapshot, label = "layout") => {
      const result = editor.load(snapshot);
      if (!result.ok) {
        pushLog("error", describeEngineError(result.error));
        return;
      }
      afterLoad();
      pushLog("info", `Loaded ${label}`);
    },
    [editor, afterLoad, pushLog],
  );

  /** Parse a JSON blueprint (structural validation via the importer) and load it. */
  const importJson = useCallback(
    (text: string, source = "import") => {
      // Parse first, so an invalid file is a plain error — never a discard prompt.
      const parsed = jsonImporter.import(text, source);
      if (!parsed.ok) {
        pushLog("error", `Import failed: ${parsed.error.issues.join("; ") || "invalid file"}`);
        return;
      }
      guard.guardDiscard("discard.open", () => importSnapshot(parsed.value, source), {
        name: source,
      });
    },
    [importSnapshot, guard, pushLog],
  );

  const loadTemplate = useCallback(
    (id: string) => {
      const template = options.templates?.find((t) => t.id === id);
      if (!template) return;
      guard.guardDiscard("discard.open", () => importSnapshot(template.snapshot, template.name), {
        name: template.name,
      });
    },
    [options.templates, importSnapshot, guard],
  );

  // --- Export -------------------------------------------------------------

  const exportJson = useCallback(() => {
    const doc = buildDocument(editor.village, catalog);
    return jsonExporter.export(doc, "layout");
  }, [editor, catalog]);

  const exportAscii = useCallback(() => {
    const doc = buildDocument(editor.village, catalog);
    return rendererExporter(asciiRenderer).export(doc, "layout");
  }, [editor, catalog]);

  const exportGltf = useCallback(() => {
    const doc = buildDocument(editor.village, catalog);
    return createGltfExporter({ coreCategory: rules.coreCategory }).export(doc, "layout");
  }, [editor, catalog, rules.coreCategory]);

  const exportPng = useCallback(
    (scale?: number): Promise<ExportResult> => {
      const doc = buildDocument(editor.village, catalog);
      const exporter = createPngExporter({
        renderSvg: (s) => svgRenderer.render(s),
        rasterize: rasterizeSvgToPng,
        ...(scale !== undefined ? { scale } : {}),
      });
      return exporter.exportAsync(doc, "layout");
    },
    [editor, catalog],
  );

  // --- Keyboard shortcuts + persistence -----------------------------------

  const shortcutCtx: ShortcutContext = {
    selectionCount: selectedIds.length,
    undo,
    redo,
    copy: clipboard.copySelection,
    paste: clipboard.paste,
    deleteSelection: deleteSelected,
    nudge: moveSelectedBy,
    setTool,
    rotate: rotateSelected,
    toggleHelp: help.toggleHelp,
  };
  useKeyboardShortcuts(shortcutCtx);

  usePersistence({ editor, persistKey: options.persistKey, version, afterLoad, pushLog });

  return {
    editor,
    scene,
    version,
    tool,
    setTool,
    viewMode,
    setViewMode,
    coreCategory: rules.coreCategory,
    placingDefinitionId,
    setPlacingDefinitionId,
    selectedIds,
    selectedId,
    setSelectedIds,
    selectedBuilding: selection.selectedBuilding,
    rotation,
    setRotation,
    log,
    validation: queries.validation,
    // Reactive rule feedback (report + per-building severity + per-definition status).
    liveValidation,
    // Reactive defense score (score + per-building weak severity + per-area summary).
    liveAnalysis,
    analysis: queries.analysis,
    ai: queries.ai,
    aiLoading: queries.aiLoading,
    canUndo: editor.history.canUndo,
    canRedo: editor.history.canRedo,
    // Read-only history projection for the history panel (re-read each render,
    // which happens on every command via the version bump).
    history: editor.history.entries,
    templates: options.templates ?? [],
    // Help overlay + first-run hint (UI state).
    helpOpen: help.helpOpen,
    hintDismissed: help.hintDismissed,
    // Pending discard confirmation (null when none).
    confirmPrompt: guard.confirmPrompt,
    // Attack replay view state.
    replay: replay.replay,
    replayTime: replay.replayTime,
    replayDuration: replay.replayDuration,
    replayPlaying: replay.replayPlaying,
    replaySpeed: replay.replaySpeed,
    deployMode: replay.deployMode,
    deployTroopId: replay.deployTroopId,
    deployments: replay.deployments,
    troopRoster: replay.troopRoster,
    actions: {
      placeBuilding,
      addWall,
      deleteAt,
      selectAt: selection.selectAt,
      selectBuilding: selection.selectBuilding,
      selectInRect: selection.selectInRect,
      deleteSelected,
      clearSelection: selection.clearSelection,
      copySelection: clipboard.copySelection,
      paste: clipboard.paste,
      rotateSelected,
      moveSelected,
      moveSelectedBy,
      applyMove,
      undo,
      redo,
      jumpHistory,
      reset,
      importSnapshot,
      importJson,
      loadTemplate,
      runValidation: queries.runValidation,
      runAnalysis: queries.runAnalysis,
      runAi: queries.runAi,
      // Replay / deploy.
      setDeployMode: replay.setDeployMode,
      setDeployTroopId: replay.setDeployTroopId,
      addDeployAt: replay.addDeployAt,
      clearDeployments: replay.clearDeployments,
      runReplay: replay.runReplay,
      exitReplay: replay.exitReplay,
      toggleReplayPlaying: replay.toggleReplayPlaying,
      seekReplay: replay.seekReplay,
      setReplaySpeed: replay.setReplaySpeed,
      exportJson,
      exportAscii,
      exportPng,
      exportGltf,
      // Help overlay + hint.
      openHelp: help.openHelp,
      closeHelp: help.closeHelp,
      toggleHelp: help.toggleHelp,
      dismissHelpHint: help.dismissHelpHint,
      // Discard confirmation.
      confirmDiscard: guard.confirmDiscard,
      cancelConfirm: guard.cancelConfirm,
    },
  };
}

export type EditorController = ReturnType<typeof useEditor>;
export type { AnalyzeAsync };
export type { LogEntry } from "./hooks/useLog";
export type { BuildingId, WallId } from "@clash/engine";
