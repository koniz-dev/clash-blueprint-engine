import {
  isRotation,
  type BuildingInstance,
  type Rotation,
  type VillageSnapshot,
  type WallSegment,
} from "@clash/engine";
import { brand, err, ok, type Result } from "@clash/shared";
import type { ImportError, Importer } from "@clash/plugins";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVec(value: unknown): { x: number; y: number } | undefined {
  if (!isObject(value)) return undefined;
  const { x, y } = value;
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  return { x, y };
}

/**
 * Parse a JSON blueprint into a `VillageSnapshot`. This performs *structural*
 * validation only (shapes and types); spatial validation (bounds, overlap,
 * known definitions) is the engine's job when `Village.fromSnapshot` rebuilds
 * it — so a structurally-valid but spatially-invalid file still fails loudly,
 * just one layer down.
 */
function parseSnapshot(text: string, source: string): Result<VillageSnapshot, ImportError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return err({ source, issues: [error instanceof Error ? error.message : String(error)] });
  }

  const issues: string[] = [];
  if (!isObject(raw)) return err({ source, issues: ["root must be an object"] });

  const grid = readVec2Size(raw.grid);
  if (!grid) issues.push("grid must be { width, height }");
  // Accept legacy `townHall` as an alias for `tier` so blueprints saved before
  // the game-agnostic migration still load.
  const tierValue = raw.tier ?? raw.townHall;
  const tier = typeof tierValue === "number" ? tierValue : undefined;
  if (tier === undefined) issues.push("tier must be a number");

  const buildings: BuildingInstance[] = [];
  if (!Array.isArray(raw.buildings)) {
    issues.push("buildings must be an array");
  } else {
    raw.buildings.forEach((entry, i) => {
      const parsed = parseBuilding(entry);
      if (parsed) buildings.push(parsed);
      else issues.push(`buildings[${i}] is malformed`);
    });
  }

  const walls: WallSegment[] = [];
  if (!Array.isArray(raw.walls)) {
    issues.push("walls must be an array");
  } else {
    raw.walls.forEach((entry, i) => {
      const parsed = parseWall(entry);
      if (parsed) walls.push(parsed);
      else issues.push(`walls[${i}] is malformed`);
    });
  }

  if (issues.length > 0 || !grid || tier === undefined) {
    return err({ source, issues });
  }
  return ok({ grid, tier, buildings, walls });
}

function readVec2Size(value: unknown): { width: number; height: number } | undefined {
  if (!isObject(value)) return undefined;
  const { width, height } = value;
  if (typeof width !== "number" || typeof height !== "number") return undefined;
  return { width, height };
}

function parseBuilding(value: unknown): BuildingInstance | undefined {
  if (!isObject(value)) return undefined;
  const position = readVec(value.position);
  const rotation: unknown = value.rotation ?? 0;
  if (
    typeof value.id !== "string" ||
    typeof value.definitionId !== "string" ||
    !position ||
    typeof rotation !== "number" ||
    !isRotation(rotation)
  ) {
    return undefined;
  }
  return {
    id: brand<"Building">(value.id),
    definitionId: value.definitionId,
    position,
    rotation: rotation as Rotation,
  };
}

function parseWall(value: unknown): WallSegment | undefined {
  if (!isObject(value)) return undefined;
  const position = readVec(value.position);
  if (typeof value.id !== "string" || !position) return undefined;
  return { id: brand<"Wall">(value.id), position };
}

/** Imports blueprints saved by the JSON exporter (or any matching shape). */
export const jsonImporter: Importer = {
  id: "json",
  kind: "importer",
  format: "json",
  import(text, source = "import.json") {
    return parseSnapshot(text, source);
  },
};
