import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type { BuildingCatalog, BuildingDefinition, VillageSnapshot } from "@clash/engine";
import { err, ok, type Result } from "@clash/shared";
import { parseGameDefinition, type GameDefinition } from "../game-definition.js";
import { buildCatalog, buildRuleSet, type RuleSet } from "../rule-set.js";
import { parseBuildingDefinitions, parseRulePack, type ParseError } from "../schema.js";

/** A fully-loaded, validated game pack ready for the engine. */
export interface GamePack {
  readonly game: GameDefinition;
  readonly catalog: BuildingCatalog;
  readonly definitions: ReadonlyArray<BuildingDefinition>;
  /** Rule sets indexed by tier. */
  readonly ruleSets: ReadonlyMap<number, RuleSet>;
  /** Named starter templates (loss-free village snapshots), by file basename. */
  readonly templates: ReadonlyMap<string, VillageSnapshot>;
}

/** @deprecated Use {@link GamePack}. */
export type DataPack = GamePack;

async function readJson(path: string): Promise<Result<unknown, ParseError>> {
  try {
    const text = await readFile(path, "utf8");
    return ok(JSON.parse(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({ source: path, issues: [message] });
  }
}

async function jsonFilesIn(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // optional directory (e.g. templates) may be absent
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(dir, entry.name))
    .sort();
}

/**
 * Load and validate a game pack from a directory laid out as:
 *
 * ```
 * <dir>/game.json               the game manifest (categories, tier, core, wall)
 * <dir>/buildings/*.json        arrays of building definitions
 * <dir>/rules/*.json            one rule pack per tier
 * <dir>/templates/*.json        (optional) starter village snapshots
 * ```
 *
 * This is the Node adapter for the data boundary — the only place that touches
 * the filesystem. Adding a whole new game is adding one of these directories;
 * no engine code changes. Every cross-reference (categories, core, tier bounds,
 * rule-pack building ids) is validated here and surfaced as a `Result`.
 */
export async function loadGamePack(dir: string): Promise<Result<GamePack, ParseError>> {
  // 1. Manifest.
  const manifestJson = await readJson(join(dir, "game.json"));
  if (!manifestJson.ok) return manifestJson;
  const gameResult = parseGameDefinition(manifestJson.value, join(dir, "game.json"));
  if (!gameResult.ok) return gameResult;
  const game = gameResult.value;

  // 2. Buildings, validated against the manifest's declared categories & tiers.
  const definitions: BuildingDefinition[] = [];
  const seenIds = new Set<string>();
  for (const file of await jsonFilesIn(join(dir, "buildings"))) {
    const json = await readJson(file);
    if (!json.ok) return json;
    const parsed = parseBuildingDefinitions(json.value, file);
    if (!parsed.ok) return parsed;
    for (const def of parsed.value) {
      if (seenIds.has(def.id)) {
        return err({ source: file, issues: [`duplicate building id "${def.id}"`] });
      }
      if (!game.categories.has(def.category)) {
        return err({
          source: file,
          issues: [`building "${def.id}" has category "${def.category}" not declared in game.json`],
        });
      }
      if (def.minTier < game.tier.min || def.minTier > game.tier.max) {
        return err({
          source: file,
          issues: [
            `building "${def.id}" minTier ${def.minTier} is outside tier range ${game.tier.min}..${game.tier.max}`,
          ],
        });
      }
      seenIds.add(def.id);
      definitions.push(def);
    }
  }

  // The game must be playable: at least one building of the core category.
  if (
    game.coreCategory !== undefined &&
    !definitions.some((d) => d.category === game.coreCategory)
  ) {
    return err({
      source: join(dir, "buildings"),
      issues: [`no building has the core category "${game.coreCategory}"`],
    });
  }

  const catalog = buildCatalog(definitions);

  // 3. Rule packs.
  const ruleSets = new Map<number, RuleSet>();
  for (const file of await jsonFilesIn(join(dir, "rules"))) {
    const json = await readJson(file);
    if (!json.ok) return json;
    const parsed = parseRulePack(json.value, file);
    if (!parsed.ok) return parsed;
    for (const entry of parsed.value.buildings) {
      if (!catalog.has(entry.id)) {
        return err({ source: file, issues: [`references unknown building id "${entry.id}"`] });
      }
    }
    ruleSets.set(parsed.value.tier, buildRuleSet(parsed.value));
  }

  // 4. Templates (optional).
  const templates = new Map<string, VillageSnapshot>();
  for (const file of await jsonFilesIn(join(dir, "templates"))) {
    const json = await readJson(file);
    if (!json.ok) return json;
    templates.set(basename(file, ".json"), json.value as VillageSnapshot);
  }

  return ok({ game, catalog, definitions, ruleSets, templates });
}

/** @deprecated Renamed to {@link loadGamePack}. */
export const loadDataPack = loadGamePack;
