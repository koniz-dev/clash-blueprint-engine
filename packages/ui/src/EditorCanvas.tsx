import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { computeFootprint, type BuildingCatalog } from "@clash/engine";
import { WALL_COLOR, categoryColor, categorySymbol } from "@clash/renderer";
import { replayStateAt } from "@clash/simulation";
import type { SceneWall } from "@clash/plugins";
import type { GridVec, Rect as TileRect } from "@clash/shared";
import { alignmentGuides, entityIdAt } from "./canvas-geometry";
import type { EditorController } from "./useEditor";

const TILE = 24;
const DRAG_THRESHOLD = 4; // px; distinguishes a click from a pan
// Live rule-feedback outline colors (error red / warning amber).
const RULE_ERROR = "#e5484d";
const RULE_WARNING = "#f5a524";
// Analyzer weak-point color (violet) — a third cue, distinct from rule/selection.
const WEAK_COLOR = "#a970ff";

/** Distinct colours for the built-in troop roster (view-only). */
const TROOP_COLORS: Record<string, string> = {
  barbarian: "#f4b350",
  archer: "#7ed957",
  giant: "#c98a5e",
  wizard: "#b06bff",
  dragon: "#e5484d",
  pekka: "#5b6bff",
  hog_rider: "#8a5a2b",
};
function troopColor(troopId: string): string {
  return TROOP_COLORS[troopId] ?? "#ffffff";
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

/** Inclusive tile rectangle spanned by two corner tiles. */
function tileRectBetween(a: GridVec, b: GridVec): TileRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  };
}

function pointerTile(stage: Konva.Stage): GridVec | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const transform = stage.getAbsoluteTransform().copy().invert();
  const world = transform.point(pos);
  return { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
}

export interface EditorCanvasProps {
  readonly controller: EditorController;
  readonly catalog: BuildingCatalog;
}

/**
 * Konva-based editing surface. It is a pure *view* over `controller.scene`:
 * it draws the scene and translates pointer input into controller actions
 * (place / select / paint walls / delete). It never mutates domain state
 * directly — all changes flow through the editor facade in {@link useEditor}.
 */
export function EditorCanvas({ controller, catalog }: EditorCanvasProps): JSX.Element {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);
  const [scale, setScale] = useState(1);
  const [hover, setHover] = useState<GridVec | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [marquee, setMarquee] = useState<TileRect | null>(null);
  const marqueeStart = useRef<GridVec | null>(null);
  const painting = useRef(false);
  const additive = useRef(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  // Drag-to-move: a candidate is armed on mouse-down over a building or wall,
  // and promoted to an active drag once the pointer actually moves.
  const pendingDrag = useRef<{
    startTile: GridVec;
    entityId: string;
    wasSelected: boolean;
  } | null>(null);
  const drag = useRef<{ startTile: GridVec; ids: string[] } | null>(null);
  const [dragDelta, setDragDelta] = useState<GridVec | null>(null);
  // Active pointers (mouse/touch/pen) for two-finger pinch-zoom on touch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const gestureWasPinch = useRef(false);

  // Hold Space to pan in the Select tool (otherwise a drag draws a marquee).
  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => {
      if (e.code === "Space") setSpaceHeld(true);
    };
    const onUp = (e: KeyboardEvent): void => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const { scene, tool } = controller;
  const gridW = scene.grid.width * TILE;
  const gridH = scene.grid.height * TILE;

  // Alignment guides while dragging (view-only geometry).
  const guides =
    drag.current && dragDelta && (dragDelta.x !== 0 || dragDelta.y !== 0)
      ? alignmentGuides(scene, new Set(drag.current.ids), dragDelta.x, dragDelta.y)
      : null;

  // Recenter the viewport on a point picked in the minimap (pan only).
  const jumpTo = (fx: number, fy: number): void => {
    const stage = stageRef.current;
    if (!stage) return;
    const s = stage.scaleX();
    stage.position({ x: size.width / 2 - fx * gridW * s, y: size.height / 2 - fy * gridH * s });
    stage.batchDraw();
  };

  // Replay projection: interpolated unit poses + cumulative destruction at the
  // current playback time. Pure view over the engine-produced timeline.
  const replayState = useMemo(
    () =>
      controller.replay ? replayStateAt(controller.replay.timeline, controller.replayTime) : null,
    [controller.replay, controller.replayTime],
  );

  /** Zoom to `targetScale` (clamped) keeping the screen point `at` fixed. */
  const zoomAround = (targetScale: number, at: { x: number; y: number }): void => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.min(3, Math.max(0.25, targetScale));
    const worldX = (at.x - stage.x()) / oldScale;
    const worldY = (at.y - stage.y()) / oldScale;
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: at.x - worldX * newScale, y: at.y - worldY * newScale });
    setScale(newScale);
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    zoomAround(stage.scaleX() * factor, pointer);
  };

  const activePointers = (): { x: number; y: number }[] => [...pointers.current.values()];
  const pointerDist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const actAt = (tile: GridVec): void => {
    if (tile.x < 0 || tile.y < 0 || tile.x >= scene.grid.width || tile.y >= scene.grid.height)
      return;
    // Deploy mode intercepts clicks to drop attackers, regardless of tool.
    if (controller.deployMode) {
      controller.actions.addDeployAt(tile);
      return;
    }
    switch (tool) {
      case "place":
        controller.actions.placeBuilding(tile);
        break;
      case "wall":
        controller.actions.addWall(tile);
        break;
      case "delete":
        controller.actions.deleteAt(tile);
        break;
      case "select":
        controller.actions.selectAt(tile, additive.current);
        break;
    }
  };

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>): void => {
    const stage = stageRef.current;
    if (!stage) return;
    pointers.current.set(e.evt.pointerId, { x: e.evt.offsetX, y: e.evt.offsetY });
    // Second finger down → pinch-zoom; cancel any in-progress single-pointer gesture.
    if (pointers.current.size >= 2) {
      const [a, b] = activePointers();
      if (a && b) pinch.current = { dist: pointerDist(a, b), scale: stage.scaleX() };
      gestureWasPinch.current = true;
      pendingDrag.current = null;
      drag.current = null;
      setDragDelta(null);
      marqueeStart.current = null;
      setMarquee(null);
      painting.current = false;
      return;
    }
    additive.current = e.evt.shiftKey;
    downPos.current = stage.getPointerPosition();
    moved.current = false;
    // In deploy mode a plain click drops a troop (handled on mouse-up); don't
    // start a marquee or a building drag.
    if (controller.deployMode) return;
    if (tool === "wall") {
      painting.current = true;
      const tile = pointerTile(stage);
      if (tile) actAt(tile);
    } else if (tool === "select" && !spaceHeld) {
      const tile = pointerTile(stage);
      const entityId = tile ? entityIdAt(scene, tile) : null;
      // Plain press on a building/wall arms a drag; shift-press or empty space
      // falls back to marquee / toggle selection.
      if (tile && entityId && !e.evt.shiftKey) {
        pendingDrag.current = {
          startTile: tile,
          entityId,
          wasSelected: controller.selectedIds.includes(entityId),
        };
      } else {
        marqueeStart.current = tile;
      }
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>): void => {
    const stage = stageRef.current;
    if (!stage) return;
    if (pointers.current.has(e.evt.pointerId)) {
      pointers.current.set(e.evt.pointerId, { x: e.evt.offsetX, y: e.evt.offsetY });
    }
    // Two-finger pinch: scale around the midpoint, skip single-pointer handling.
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = activePointers();
      if (a && b && pinch.current.dist > 0) {
        const ratio = pointerDist(a, b) / pinch.current.dist;
        zoomAround(pinch.current.scale * ratio, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      return;
    }
    const tile = pointerTile(stage);
    setHover(tile);
    const start = downPos.current;
    const now = stage.getPointerPosition();
    if (start && now && Math.hypot(now.x - start.x, now.y - start.y) > DRAG_THRESHOLD) {
      moved.current = true;
    }
    if (painting.current && tool === "wall" && tile) actAt(tile);

    // Promote an armed candidate into an active drag on first real movement.
    if (pendingDrag.current && !drag.current && moved.current) {
      const p = pendingDrag.current;
      const entityIds = new Set<string>([
        ...scene.buildings.map((b) => b.id),
        ...scene.walls.map((w) => w.id),
      ]);
      let ids: string[];
      if (p.wasSelected) {
        // Drag the whole selection (buildings and walls) together.
        ids = controller.selectedIds.filter((id) => entityIds.has(id));
      } else {
        controller.actions.selectBuilding(p.entityId, false);
        ids = [p.entityId];
      }
      drag.current = { startTile: p.startTile, ids };
    }
    if (drag.current && tile) {
      setDragDelta({ x: tile.x - drag.current.startTile.x, y: tile.y - drag.current.startTile.y });
    }
    if (marqueeStart.current && tile) setMarquee(tileRectBetween(marqueeStart.current, tile));
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent>): void => {
    const stage = stageRef.current;
    pointers.current.delete(e.evt.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // Still fingers down (mid-pinch) — don't commit a single-pointer gesture.
    if (pointers.current.size >= 1) return;
    // A pinch just ended: swallow the release so it doesn't fire a phantom click.
    if (gestureWasPinch.current) {
      gestureWasPinch.current = false;
      return;
    }
    painting.current = false;
    if (!stage) return;
    if (tool === "wall") return; // handled on down/move

    // Commit an active drag as a single move gesture.
    if (drag.current) {
      const delta = dragDelta;
      drag.current = null;
      pendingDrag.current = null;
      setDragDelta(null);
      if (moved.current && delta && (delta.x !== 0 || delta.y !== 0)) {
        controller.actions.moveSelectedBy(delta.x, delta.y);
      }
      return;
    }
    // An armed-but-not-dragged candidate is just a click → fall through to select.
    pendingDrag.current = null;

    if (tool === "select" && marqueeStart.current) {
      const start = marqueeStart.current;
      marqueeStart.current = null;
      setMarquee(null);
      const end = pointerTile(stage);
      if (moved.current && end) {
        controller.actions.selectInRect(tileRectBetween(start, end), additive.current);
        return;
      }
    }

    if (moved.current) return; // it was a pan, not a click
    const tile = pointerTile(stage);
    if (tile) actAt(tile);
  };

  // Grab cursor for the Hand tool (and while Space-panning in Select), matching
  // the Figma-style panning affordance.
  const panning = tool === "hand" || (tool === "select" && spaceHeld);
  return (
    <div ref={ref} className={`cbe-canvas${panning ? " cbe-canvas-pan" : ""}`}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={tool === "wall" ? false : tool === "select" ? spaceHeld : true}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          painting.current = false;
          marqueeStart.current = null;
          pendingDrag.current = null;
          drag.current = null;
          pointers.current.clear();
          pinch.current = null;
          gestureWasPinch.current = false;
          setDragDelta(null);
          setMarquee(null);
          setHover(null);
        }}
      >
        <Layer>
          <Rect x={0} y={0} width={gridW} height={gridH} fill="#eceff1" stroke="#b0bec5" />
          {/* Grid lines */}
          {Array.from({ length: scene.grid.width + 1 }, (_, i) => (
            <Line
              key={`v${i}`}
              points={[i * TILE, 0, i * TILE, gridH]}
              stroke="#cfd8dc"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: scene.grid.height + 1 }, (_, i) => (
            <Line
              key={`h${i}`}
              points={[0, i * TILE, gridW, i * TILE]}
              stroke="#cfd8dc"
              strokeWidth={1}
            />
          ))}
        </Layer>

        <Layer>
          {/* Walls (auto-connected via scene connection flags) */}
          {scene.walls.map((wall) => (
            <WallPiece
              key={wall.id}
              wall={wall}
              selected={controller.selectedIds.includes(wall.id)}
              broken={replayState?.brokenWallIds.has(wall.id) ?? false}
            />
          ))}
          {/* Buildings */}
          {scene.buildings.map((b) => {
            const selected = controller.selectedIds.includes(b.id);
            const destroyed = replayState?.destroyedBuildingIds.has(b.id) ?? false;
            // Three coexisting cues on one building: (1) rule violation = its own
            // solid border, (2) selection = an outer yellow ring, (3) analyzer weak
            // point = an inset dashed violet ring.
            const severity = controller.liveValidation.severityById.get(b.id);
            const stroke =
              severity === "error" ? RULE_ERROR : severity === "warning" ? RULE_WARNING : "#263238";
            const weak = controller.liveAnalysis.weakById.get(b.id);
            return (
              <Group key={b.id} opacity={destroyed ? 0.25 : 1}>
                <Rect
                  x={b.bounds.x * TILE}
                  y={b.bounds.y * TILE}
                  width={b.bounds.width * TILE}
                  height={b.bounds.height * TILE}
                  cornerRadius={3}
                  fill={destroyed ? "#5a5a5a" : categoryColor(b.category)}
                  opacity={0.9}
                  stroke={stroke}
                  strokeWidth={severity ? 3 : 1}
                />
                {weak && (
                  <Rect
                    x={b.bounds.x * TILE + 2}
                    y={b.bounds.y * TILE + 2}
                    width={b.bounds.width * TILE - 4}
                    height={b.bounds.height * TILE - 4}
                    cornerRadius={2}
                    stroke={WEAK_COLOR}
                    strokeWidth={weak === "critical" ? 2.5 : 1.5}
                    dash={[4, 3]}
                    listening={false}
                  />
                )}
                {selected && (
                  <Rect
                    x={b.bounds.x * TILE - 2}
                    y={b.bounds.y * TILE - 2}
                    width={b.bounds.width * TILE + 4}
                    height={b.bounds.height * TILE + 4}
                    cornerRadius={4}
                    stroke="#ffd600"
                    strokeWidth={2}
                    listening={false}
                  />
                )}
                <Text
                  x={b.bounds.x * TILE}
                  y={b.bounds.y * TILE}
                  width={b.bounds.width * TILE}
                  height={b.bounds.height * TILE}
                  text={categorySymbol(b.category)}
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                  fontSize={TILE * 0.7}
                  fontStyle="bold"
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Directional weak-side markers (violet bars on weak compass edges) */}
          {[...controller.liveAnalysis.byArea.entries()].map(([area, sev]) => {
            const barLen = Math.min(gridW, gridH) * 0.15;
            const th = 4;
            const rect =
              area === "north"
                ? { x: (gridW - barLen) / 2, y: 0, width: barLen, height: th }
                : area === "south"
                  ? { x: (gridW - barLen) / 2, y: gridH - th, width: barLen, height: th }
                  : area === "east"
                    ? { x: gridW - th, y: (gridH - barLen) / 2, width: th, height: barLen }
                    : area === "west"
                      ? { x: 0, y: (gridH - barLen) / 2, width: th, height: barLen }
                      : null;
            if (!rect) return null; // center / overall are panel-only
            return (
              <Rect
                key={`weakarea-${area}`}
                {...rect}
                cornerRadius={2}
                fill={WEAK_COLOR}
                opacity={sev === "critical" ? 0.9 : 0.6}
                listening={false}
              />
            );
          })}

          {/* Hover / placement preview */}
          {hover && <PlacementPreview controller={controller} catalog={catalog} tile={hover} />}

          {/* Drag-to-move ghost: selected buildings + walls offset by the live delta */}
          {drag.current && dragDelta && (dragDelta.x !== 0 || dragDelta.y !== 0) && (
            <>
              {scene.buildings
                .filter((b) => drag.current?.ids.includes(b.id))
                .map((b) => (
                  <Rect
                    key={`ghost-${b.id}`}
                    x={(b.bounds.x + dragDelta.x) * TILE}
                    y={(b.bounds.y + dragDelta.y) * TILE}
                    width={b.bounds.width * TILE}
                    height={b.bounds.height * TILE}
                    cornerRadius={3}
                    fill={categoryColor(b.category)}
                    opacity={0.4}
                    stroke="#ffd600"
                    strokeWidth={2}
                    dash={[4, 4]}
                    listening={false}
                  />
                ))}
              {scene.walls
                .filter((w) => drag.current?.ids.includes(w.id))
                .map((w) => (
                  <Rect
                    key={`ghost-${w.id}`}
                    x={(w.position.x + dragDelta.x) * TILE}
                    y={(w.position.y + dragDelta.y) * TILE}
                    width={TILE}
                    height={TILE}
                    cornerRadius={2}
                    fill={WALL_COLOR}
                    opacity={0.4}
                    stroke="#ffd600"
                    strokeWidth={2}
                    dash={[4, 4]}
                    listening={false}
                  />
                ))}
            </>
          )}

          {/* Alignment guides: edges/centres that line up with static entities */}
          {guides?.xs.map((x) => (
            <Line
              key={`gx${x}`}
              points={[x * TILE, 0, x * TILE, gridH]}
              stroke="#ff5ca8"
              strokeWidth={1}
              dash={[3, 3]}
              listening={false}
            />
          ))}
          {guides?.ys.map((y) => (
            <Line
              key={`gy${y}`}
              points={[0, y * TILE, gridW, y * TILE]}
              stroke="#ff5ca8"
              strokeWidth={1}
              dash={[3, 3]}
              listening={false}
            />
          ))}

          {/* Marquee (drag-box) selection outline */}
          {marquee && (
            <Rect
              x={marquee.x * TILE}
              y={marquee.y * TILE}
              width={marquee.width * TILE}
              height={marquee.height * TILE}
              fill="#4f9cf9"
              opacity={0.15}
              stroke="#4f9cf9"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}

          {/* Deploy markers (chosen troops, before/without a running replay) */}
          {!replayState &&
            controller.deployments.map((d, i) => (
              <Circle
                key={`deploy-${i}`}
                x={(d.position.x + 0.5) * TILE}
                y={(d.position.y + 0.5) * TILE}
                radius={TILE * 0.3}
                fill={troopColor(d.troopId)}
                opacity={0.7}
                stroke="#04121f"
                strokeWidth={1}
                listening={false}
              />
            ))}

          {/* Live attacking units during replay */}
          {replayState?.units.map((u) => (
            <Circle
              key={`unit-${u.id}`}
              x={(u.x + 0.5) * TILE}
              y={(u.y + 0.5) * TILE}
              radius={TILE * 0.28}
              fill={troopColor(u.troopId)}
              stroke="#04121f"
              strokeWidth={1}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
      <MiniMap scene={scene} onJump={jumpTo} />
      <div className="cbe-zoom-badge">{Math.round(scale * 100)}%</div>
    </div>
  );
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A small overview of the whole grid for orientation on large layouts. It is a
 * pure projection of the `Scene` (buildings + walls); clicking recenters the
 * viewport (pan only — it never mutates the village).
 */
function MiniMap({
  scene,
  onJump,
}: {
  scene: EditorController["scene"];
  onJump: (fx: number, fy: number) => void;
}): JSX.Element {
  const { width: w, height: h } = scene.grid;
  const handleClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    onJump(
      clamp01((e.clientX - rect.left) / rect.width),
      clamp01((e.clientY - rect.top) / rect.height),
    );
  };
  return (
    <svg
      className="cbe-minimap"
      viewBox={`0 0 ${w} ${h}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      preserveAspectRatio="none"
      role="img"
      aria-label="Minimap — click to recenter"
      onClick={handleClick}
    >
      <rect x={0} y={0} width={w} height={h} className="cbe-minimap-bg" />
      {scene.walls.map((wall) => (
        <rect
          key={wall.id}
          x={wall.position.x}
          y={wall.position.y}
          width={1}
          height={1}
          fill={WALL_COLOR}
        />
      ))}
      {scene.buildings.map((b) => (
        <rect
          key={b.id}
          x={b.bounds.x}
          y={b.bounds.y}
          width={b.bounds.width}
          height={b.bounds.height}
          fill={categoryColor(b.category)}
        />
      ))}
    </svg>
  );
}

/** A wall tile that visually bridges to its connected neighbours (auto-connect). */
function WallPiece({
  wall,
  selected,
  broken,
}: {
  wall: SceneWall;
  selected: boolean;
  broken: boolean;
}): JSX.Element {
  const x = wall.position.x * TILE;
  const y = wall.position.y * TILE;
  const inset = 3;
  const size = TILE - inset * 2;
  const color = WALL_COLOR;
  const { connections } = wall;
  return (
    <Group opacity={broken ? 0.2 : 1}>
      {selected && (
        <Rect
          x={x}
          y={y}
          width={TILE}
          height={TILE}
          cornerRadius={2}
          stroke="#ffd600"
          strokeWidth={2}
          listening={false}
        />
      )}
      <Rect x={x + inset} y={y + inset} width={size} height={size} cornerRadius={2} fill={color} />
      {connections.north && <Rect x={x + inset} y={y} width={size} height={inset} fill={color} />}
      {connections.south && (
        <Rect x={x + inset} y={y + TILE - inset} width={size} height={inset} fill={color} />
      )}
      {connections.west && <Rect x={x} y={y + inset} width={inset} height={size} fill={color} />}
      {connections.east && (
        <Rect x={x + TILE - inset} y={y + inset} width={inset} height={size} fill={color} />
      )}
    </Group>
  );
}

function PlacementPreview({
  controller,
  catalog,
  tile,
}: {
  controller: EditorController;
  catalog: BuildingCatalog;
  tile: GridVec;
}): JSX.Element | null {
  const { tool, placingDefinitionId, rotation } = controller;
  if (tool === "place" && placingDefinitionId) {
    const def = catalog.get(placingDefinitionId);
    if (!def) return null;
    const { bounds } = computeFootprint(def, tile, rotation);
    // Would placing this now break a count/unlock rule? Tint the preview red.
    const status = controller.liveValidation.perDefinition.get(placingDefinitionId);
    const wouldViolate = status ? !status.unlocked || !status.allowed || status.atMax : false;
    return (
      <Rect
        x={bounds.x * TILE}
        y={bounds.y * TILE}
        width={bounds.width * TILE}
        height={bounds.height * TILE}
        cornerRadius={3}
        fill={wouldViolate ? RULE_ERROR : categoryColor(def.category)}
        opacity={wouldViolate ? 0.5 : 0.4}
        stroke={wouldViolate ? RULE_ERROR : undefined}
        strokeWidth={wouldViolate ? 2 : 0}
        dash={wouldViolate ? [4, 4] : undefined}
        listening={false}
      />
    );
  }
  if (tool === "wall" || tool === "delete") {
    return (
      <Rect
        x={tile.x * TILE}
        y={tile.y * TILE}
        width={TILE}
        height={TILE}
        fill={tool === "delete" ? "#e53935" : WALL_COLOR}
        opacity={0.35}
        listening={false}
      />
    );
  }
  return null;
}
