import type { BuildingCatalog, GameRules } from "@clash/engine";
import { jsonImporter } from "@clash/importer";
import type { EditorTemplate } from "@clash/ui";
import {
  buildCatalog,
  buildRuleSet,
  gameRulesFrom,
  parseBuildingDefinitions,
  parseGameDefinition,
  parseRulePack,
  type RuleSet,
} from "@clash/rules-engine";

// The canonical game pack lives at the repo root. It is validated here through
// the same parsers the Node loader uses — just bundled for the browser instead
// of read from disk.
import gameManifest from "../../../data/games/clash-of-clans/game.json";
import army from "../../../data/games/clash-of-clans/buildings/army.json";
import core from "../../../data/games/clash-of-clans/buildings/core.json";
import defense from "../../../data/games/clash-of-clans/buildings/defense.json";
import resource from "../../../data/games/clash-of-clans/buildings/resource.json";
import traps from "../../../data/games/clash-of-clans/buildings/traps.json";
import tier8 from "../../../data/games/clash-of-clans/rules/tier-8.json";
import starter from "../../../data/games/clash-of-clans/templates/starter.json";

function loadGame() {
  const parsed = parseGameDefinition(gameManifest);
  if (!parsed.ok) throw new Error(`Invalid game manifest: ${parsed.error.issues.join(", ")}`);
  return parsed.value;
}

function loadCatalog(): BuildingCatalog {
  const parsed = parseBuildingDefinitions([...core, ...defense, ...resource, ...army, ...traps]);
  if (!parsed.ok) throw new Error(`Invalid building data: ${parsed.error.issues.join(", ")}`);
  return buildCatalog(parsed.value);
}

function loadRuleSet(): RuleSet {
  const parsed = parseRulePack(tier8);
  if (!parsed.ok) throw new Error(`Invalid rule pack: ${parsed.error.issues.join(", ")}`);
  return buildRuleSet(parsed.value);
}

const game = loadGame();
export const rules: GameRules = gameRulesFrom(game);
export const tierLabel = game.tier.label;
export const catalog: BuildingCatalog = loadCatalog();
export const ruleSet: RuleSet = loadRuleSet();
export const tier = 8;
export const gridSize = ruleSet.gridSize;

// Bundled starter layouts offered in the editor's "Open" gallery. Parsed
// through the same importer users' files go through, so branded types and
// structural validation come for free (the engine re-validates on load).
function loadTemplate(id: string, name: string, raw: unknown): EditorTemplate {
  const parsed = jsonImporter.import(JSON.stringify(raw), id);
  if (!parsed.ok) throw new Error(`Invalid template ${id}: ${parsed.error.issues.join(", ")}`);
  return { id, name, snapshot: parsed.value };
}

export const templates: EditorTemplate[] = [loadTemplate("starter", "Starter Base (TH8)", starter)];

/** localStorage key for autosave/restore, namespaced by game. */
export const persistKey = `cbe:${game.id}:layout`;
