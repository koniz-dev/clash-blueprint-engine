import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GAME_RULES,
  VillageEditor,
  describeEngineError,
  rotateClockwise,
  type BuildingCatalog,
  type BuildingDefinition,
  type BuildingId,
  type GameRules,
  type Rotation,
  type StoredEvent,
  type VillageSnapshot,
  type WallId,
} from "@clash/engine";
import { brand, rectsIntersect, type GridVec, type Rect } from "@clash/shared";
import { asciiRenderer, buildDocument, buildScene, svgRenderer } from "@clash/renderer";
import { createPngExporter, jsonExporter, rendererExporter } from "@clash/exporter";
import { jsonImporter } from "@clash/importer";
import { ValidationEngine, type RuleSet, type ValidationReport } from "@clash/rules-engine";
import {
  DEFAULT_TROOPS,
  replayDuration,
  simulateAttack,
  type Deployment,
  type SimulationResult,
} from "@clash/simulation";
import { analyzeLayout, type DefenseScore } from "@clash/analyzer";
import { recommendImprovements, type AiReport } from "@clash/ai";
import type { ExportResult, Scene } from "@clash/plugins";
import { rasterizeSvgToPng } from "./png";
import { resolveShortcut, type ShortcutContext } from "./shortcuts";

export type Tool = "select" | "place" | "wall" | "delete";

/** Which view renders the layout: the 2D Konva canvas or the 3D three.js scene. */
export type ViewMode = "2d" | "3d";

export interface LogEntry {
  readonly id: number;
  readonly kind: "info" | "error" | "event";
  readonly message: string;
}

/** Off-thread AI runner (e.g. a Web Worker). Keeps `@clash/ui` worker-agnostic. */
export type AnalyzeAsync = (input: {
  snapshot: VillageSnapshot;
  definitions: BuildingDefinition[];
}) => Promise<AiReport>;

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
 * UI-only state (current tool, selection, camera is elsewhere). Every mutation
 * goes through the editor facade — this hook contains **no game rules**, it only
 * dispatches commands and reflects engine state back to React.
 *
 * Re-renders are driven by subscribing to the engine's `CommandStack` and
 * `EventStore`, so the view always mirrors the domain without manual wiring.
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

  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [placingDefinitionId, setPlacingDefinitionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const clipboard = useRef<{ definitionId: string; position: GridVec; rotation: Rotation }[]>([]);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [analysis, setAnalysis] = useState<DefenseScore | null>(null);
  const [ai, setAi] = useState<AiReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Attack replay (view over the deterministic simulation timeline).
  const [replay, setReplay] = useState<SimulationResult | null>(null);
  const [replayTime, setReplayTime] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [deployMode, setDeployMode] = useState(false);
  const [deployTroopId, setDeployTroopId] = useState<string>(DEFAULT_TROOPS[0]?.id ?? "barbarian");
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  // Bumped after `editor.load` swaps in fresh EventStore/CommandStack instances,
  // so the subscription effect re-binds to the new ones.
  const [subEpoch, setSubEpoch] = useState(0);
  // In-UI help overlay + first-run hint (pure UI state).
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(true);
  // Pending confirmation before an action that discards the current layout.
  const [confirmPrompt, setConfirmPrompt] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const logId = useRef(0);

  const pushLog = useCallback((kind: LogEntry["kind"], message: string) => {
    setLog((prev) => [{ id: ++logId.current, kind, message }, ...prev].slice(0, 100));
  }, []);

  // Reflect every engine change into React. Re-runs on `subEpoch` so it always
  // subscribes to the editor's *current* event/command stores (a load replaces
  // them), never a stale instance.
  useEffect(() => {
    const offHistory = editor.history.onChanged(() => bump());
    const offEvents = editor.events.onAppended((stored: StoredEvent) => {
      pushLog("event", stored.event.type);
      bump();
    });
    return () => {
      offHistory();
      offEvents();
    };
  }, [editor, pushLog, bump, subEpoch]);

  const scene: Scene = useMemo(
    () => buildScene(editor.village, catalog, { tierLabel }),
    // Rebuild whenever the domain changed (version bumps on every command/event).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, catalog, tierLabel, version],
  );

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
    [editor],
  );

  const selectAt = useCallback(
    (position: GridVec, additive = false) => {
      // Buildings and walls are both selectable; the occupant map covers both.
      const occupant = editor.village.occupantAt(position);
      const id =
        occupant &&
        (editor.village.getBuilding(brand<"Building">(occupant)) ||
          editor.village.getWall(brand<"Wall">(occupant)))
          ? occupant
          : null;
      if (!id) {
        if (!additive) setSelectedIds([]);
        return;
      }
      setSelectedIds((prev) =>
        additive
          ? prev.includes(id)
            ? prev.filter((existing) => existing !== id)
            : [...prev, id]
          : [id],
      );
    },
    [editor],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  // Select a building directly by id (used by the 3D view's mesh clicks).
  const selectBuilding = useCallback((id: string, additive = false) => {
    setSelectedIds((prev) =>
      additive
        ? prev.includes(id)
          ? prev.filter((existing) => existing !== id)
          : [...prev, id]
        : [id],
    );
  }, []);

  const selectInRect = useCallback(
    (rect: Rect, additive = false) => {
      const buildingIds = scene.buildings
        .filter((b) => rectsIntersect(b.bounds, rect))
        .map((b) => b.id);
      const wallIds = scene.walls
        .filter((w) =>
          rectsIntersect({ x: w.position.x, y: w.position.y, width: 1, height: 1 }, rect),
        )
        .map((w) => w.id);
      const ids = [...buildingIds, ...wallIds];
      setSelectedIds((prev) => (additive ? Array.from(new Set([...prev, ...ids])) : ids));
    },
    [scene],
  );

  /** Split the current selection into its building ids and wall ids. */
  const partitionSelection = useCallback(() => {
    const buildingIds: BuildingId[] = [];
    const wallIds: WallId[] = [];
    for (const id of selectedIds) {
      if (editor.village.getBuilding(brand<"Building">(id)))
        buildingIds.push(brand<"Building">(id));
      else if (editor.village.getWall(brand<"Wall">(id))) wallIds.push(brand<"Wall">(id));
    }
    return { buildingIds, wallIds };
  }, [editor, selectedIds]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const { buildingIds, wallIds } = partitionSelection();
    const result = editor.removeEntities(buildingIds, wallIds);
    if (!result.ok) pushLog("error", describeEngineError(result.error));
    setSelectedIds([]);
  }, [editor, selectedIds, partitionSelection, pushLog]);

  /**
   * Translate every selected *building* by a tile delta as one undoable
   * gesture (drag-to-move, arrow-key nudge). Walls in the selection are left in
   * place — they aren't movable. A zero delta is a no-op.
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
      // One atomic gesture for a mixed building + wall selection.
      const result = editor.moveEntities(buildingMoves, wallMoves);
      if (!result.ok) pushLog("error", describeEngineError(result.error));
    },
    [editor, partitionSelection, pushLog],
  );

  const copySelection = useCallback(() => {
    clipboard.current = selectedIds.flatMap((id) => {
      const b = editor.village.getBuilding(brand<"Building">(id));
      return b
        ? [{ definitionId: b.definitionId, position: b.position, rotation: b.rotation }]
        : [];
    });
    if (clipboard.current.length > 0) {
      pushLog("info", `Copied ${clipboard.current.length} building(s)`);
    }
  }, [editor, selectedIds, pushLog]);

  const paste = useCallback(() => {
    const OFFSET = 2;
    const pastedIds: string[] = [];
    for (const item of clipboard.current) {
      const target = { x: item.position.x + OFFSET, y: item.position.y + OFFSET };
      const result = editor.addBuilding(item.definitionId, target, item.rotation);
      if (result.ok) pastedIds.push(result.value);
    }
    if (pastedIds.length > 0) {
      setSelectedIds(pastedIds);
      pushLog("info", `Pasted ${pastedIds.length} building(s)`);
    }
  }, [editor, pushLog]);

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

  const resetPanels = useCallback(() => {
    setSelectedIds([]);
    setValidation(null);
    setAnalysis(null);
    setAi(null);
  }, []);

  // Called after `editor.load`: re-bind subscriptions to the new stores, rebuild
  // the scene, and clear stale panel/selection state.
  const afterLoad = useCallback(() => {
    setSubEpoch((e) => e + 1);
    bump();
    resetPanels();
  }, [bump, resetPanels]);

  // Guard actions that discard the current layout: prompt only when there is
  // something to lose (a non-empty layout); otherwise run immediately.
  const guardDiscard = useCallback(
    (message: string, action: () => void) => {
      if (editor.village.buildingCount === 0 && editor.village.wallCount === 0) {
        action();
      } else {
        setConfirmPrompt({ message, onConfirm: action });
      }
    },
    [editor],
  );
  const confirmDiscard = useCallback(() => {
    setConfirmPrompt((prompt) => {
      prompt?.onConfirm();
      return null;
    });
  }, []);
  const cancelConfirm = useCallback(() => setConfirmPrompt(null), []);

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
  const reset = useCallback(
    () =>
      guardDiscard("Start a new, empty layout? Your current layout will be discarded.", resetNow),
    [guardDiscard, resetNow],
  );

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
      guardDiscard(`Open “${source}”? Your current layout will be replaced.`, () =>
        importSnapshot(parsed.value, source),
      );
    },
    [importSnapshot, guardDiscard, pushLog],
  );

  const loadTemplate = useCallback(
    (id: string) => {
      const template = options.templates?.find((t) => t.id === id);
      if (!template) return;
      guardDiscard(`Open “${template.name}”? Your current layout will be replaced.`, () =>
        importSnapshot(template.snapshot, template.name),
      );
    },
    [options.templates, importSnapshot, guardDiscard],
  );

  // --- Queries (validation / analysis / AI, on demand) --------------------

  const runValidation = useCallback(() => {
    if (!ruleSet) {
      pushLog("info", "No rule set loaded");
      return;
    }
    const report = new ValidationEngine().validateAndRecord(
      editor.village,
      ruleSet,
      catalog,
      editor.events,
      rules,
    );
    setValidation(report);
    pushLog("info", `Validation: ${report.errors} errors, ${report.warnings} warnings`);
  }, [editor, ruleSet, catalog, rules, pushLog]);

  const runAnalysis = useCallback(() => {
    const score = analyzeLayout(editor.village, catalog, rules);
    setAnalysis(score);
    pushLog("info", `Defense score ${score.overall} (grade ${score.grade})`);
  }, [editor, catalog, rules, pushLog]);

  const runAi = useCallback(async () => {
    const applyReport = (report: AiReport): void => {
      setAi(report);
      setAnalysis(report.defenseScore);
      pushLog("info", `AI: ${report.recommendations.length} recommendations`);
    };

    if (analyzeAsync) {
      // Off-thread: the heavy attack simulations don't block the UI.
      setAiLoading(true);
      pushLog("info", "Running AI analysis…");
      try {
        const report = await analyzeAsync({
          snapshot: editor.village.toSnapshot(),
          definitions: [...catalog.all()],
        });
        applyReport(report);
      } catch (error) {
        pushLog("error", `AI failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    // Synchronous fallback (tests, non-worker hosts).
    applyReport(
      recommendImprovements(editor.village, catalog, { probeOptions: { maxSeconds: 45 }, rules }),
    );
  }, [editor, catalog, analyzeAsync, rules, pushLog]);

  // --- Attack replay ------------------------------------------------------
  // The simulation runs in @clash/simulation; this hook only kicks it off and
  // animates the returned timeline. No combat logic lives here.

  const addDeployAt = useCallback(
    (position: GridVec) => {
      setDeployments((prev) => [...prev, { troopId: deployTroopId, position }]);
    },
    [deployTroopId],
  );

  const clearDeployments = useCallback(() => setDeployments([]), []);

  const runReplay = useCallback(() => {
    if (deployments.length === 0) {
      pushLog("info", "Add attacking troops first (Deploy), then Play");
      return;
    }
    const result = simulateAttack(editor.village, catalog, deployments, { rules });
    setReplay(result);
    setReplayTime(0);
    setReplayPlaying(true);
    setDeployMode(false);
    pushLog(
      "info",
      `Attack: ${result.stars}★ · ${result.destructionPercent}% in ${result.durationSeconds.toFixed(1)}s`,
    );
  }, [editor, catalog, deployments, rules, pushLog]);

  const exitReplay = useCallback(() => {
    setReplay(null);
    setReplayPlaying(false);
    setReplayTime(0);
  }, []);

  const toggleReplayPlaying = useCallback(() => {
    if (!replay) return;
    setReplayPlaying((playing) => {
      // Restart from the beginning if we're paused at the very end.
      if (!playing && replayTime >= replayDuration(replay.timeline)) setReplayTime(0);
      return !playing;
    });
  }, [replay, replayTime]);

  const seekReplay = useCallback((time: number) => {
    setReplayPlaying(false);
    setReplayTime(time);
  }, []);

  // Playback clock: advance replayTime by wall-clock × speed while playing.
  const duration = replay ? replayDuration(replay.timeline) : 0;
  useEffect(() => {
    if (!replay || !replayPlaying) return;
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number): void => {
      if (last !== null) {
        const dt = ((now - last) / 1000) * replaySpeed;
        setReplayTime((t) => {
          const next = t + dt;
          if (next >= duration) {
            setReplayPlaying(false);
            return duration;
          }
          return next;
        });
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [replay, replayPlaying, replaySpeed, duration]);

  // --- Export -------------------------------------------------------------

  const exportJson = useCallback(() => {
    const doc = buildDocument(editor.village, catalog);
    return jsonExporter.export(doc, "layout");
  }, [editor, catalog]);

  const exportAscii = useCallback(() => {
    const doc = buildDocument(editor.village, catalog);
    return rendererExporter(asciiRenderer).export(doc, "layout");
  }, [editor, catalog]);

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

  // --- Help overlay + first-run hint --------------------------------------
  // Reuse the autosave-key convention so the hint is remembered per game.
  const helpHintKey = `${options.persistKey ?? "cbe"}:help-hint`;
  const dismissHelpHint = useCallback(() => {
    setHintDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem(helpHintKey, "1");
  }, [helpHintKey]);
  const openHelp = useCallback(() => {
    setHelpOpen(true);
    dismissHelpHint();
  }, [dismissHelpHint]);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const toggleHelp = useCallback(() => {
    setHelpOpen((open) => !open);
    dismissHelpHint();
  }, [dismissHelpHint]);

  // Show the first-run hint once, unless previously dismissed (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintDismissed(window.localStorage.getItem(helpHintKey) === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts (client-only). All bindings live in the declarative
  // `SHORTCUTS` registry (the same list the help overlay renders), so the
  // handler is a thin dispatcher: match the event, run the shortcut. No binding
  // is defined here — one edit in `shortcuts.ts` updates handler + help + tooltips.
  useEffect(() => {
    const ctx: ShortcutContext = {
      selectionCount: selectedIds.length,
      undo,
      redo,
      copy: copySelection,
      paste,
      deleteSelection: deleteSelected,
      nudge: moveSelectedBy,
      setTool,
      rotate: rotateSelected,
      toggleHelp,
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const shortcut = resolveShortcut(e);
      if (!shortcut || (shortcut.when && !shortcut.when(ctx))) return;
      if (shortcut.preventDefault) e.preventDefault();
      shortcut.run(ctx, e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    undo,
    redo,
    copySelection,
    paste,
    deleteSelected,
    moveSelectedBy,
    rotateSelected,
    setTool,
    toggleHelp,
    selectedIds,
  ]);

  // --- Persistence: restore on mount, autosave on change ------------------
  const { persistKey } = options;
  const hydrated = useRef(false);

  // Restore the last session once (client-only), before autosave arms.
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") {
      hydrated.current = true;
      return;
    }
    const saved = window.localStorage.getItem(persistKey);
    if (saved) {
      const parsed = jsonImporter.import(saved, "autosave");
      if (parsed.ok && (parsed.value.buildings.length > 0 || parsed.value.walls.length > 0)) {
        const loaded = editor.load(parsed.value);
        if (loaded.ok) {
          afterLoad();
          pushLog("info", "Restored your last session");
        }
      }
    }
    hydrated.current = true;
    // Run exactly once for this editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, persistKey]);

  // Autosave (debounced) after any domain change, once hydrated.
  useEffect(() => {
    if (!persistKey || typeof window === "undefined" || !hydrated.current) return;
    const id = window.setTimeout(() => {
      window.localStorage.setItem(persistKey, JSON.stringify(editor.toSnapshot()));
    }, 400);
    return () => window.clearTimeout(id);
  }, [editor, persistKey, version]);

  const selectedBuilding = selectedId
    ? editor.village.getBuilding(brand<"Building">(selectedId))
    : undefined;

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
    selectedBuilding,
    rotation,
    setRotation,
    log,
    validation,
    analysis,
    ai,
    aiLoading,
    canUndo: editor.history.canUndo,
    canRedo: editor.history.canRedo,
    templates: options.templates ?? [],
    // Help overlay + first-run hint (UI state).
    helpOpen,
    hintDismissed,
    // Pending discard confirmation (null when none).
    confirmPrompt,
    // Attack replay view state.
    replay,
    replayTime,
    replayDuration: duration,
    replayPlaying,
    replaySpeed,
    deployMode,
    deployTroopId,
    deployments,
    troopRoster: DEFAULT_TROOPS.map((t) => ({ id: t.id, name: t.name })),
    actions: {
      placeBuilding,
      addWall,
      deleteAt,
      selectAt,
      selectBuilding,
      selectInRect,
      deleteSelected,
      clearSelection,
      copySelection,
      paste,
      rotateSelected,
      moveSelected,
      moveSelectedBy,
      applyMove,
      undo,
      redo,
      reset,
      importSnapshot,
      importJson,
      loadTemplate,
      runValidation,
      runAnalysis,
      runAi,
      // Replay / deploy.
      setDeployMode,
      setDeployTroopId,
      addDeployAt,
      clearDeployments,
      runReplay,
      exitReplay,
      toggleReplayPlaying,
      seekReplay,
      setReplaySpeed,
      exportJson,
      exportAscii,
      exportPng,
      // Help overlay + hint.
      openHelp,
      closeHelp,
      toggleHelp,
      dismissHelpHint,
      // Discard confirmation.
      confirmDiscard,
      cancelConfirm,
    },
  };
}

export type EditorController = ReturnType<typeof useEditor>;
export type { BuildingId, WallId };
