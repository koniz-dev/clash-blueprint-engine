import {
  InMemoryBuildingCatalog,
  type BuildingCatalog,
  type BuildingDefinition,
} from "@clash/engine";
import { buildRuleSet, parseRulePack, type RuleSet } from "@clash/rules-engine";

/** A compact building catalog for Storybook stories (not game-accurate). */
export const STORY_DEFS: BuildingDefinition[] = [
  {
    id: "town_hall",
    name: "Town Hall",
    category: "townhall",
    width: 4,
    height: 4,
    minTier: 1,
    hitpoints: 1500,
  },
  {
    id: "cannon",
    name: "Cannon",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 1,
    attackRange: 9,
    damageType: "single",
    targets: ["ground"],
  },
  {
    id: "archer_tower",
    name: "Archer Tower",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 2,
    attackRange: 10,
    damageType: "single",
    targets: ["ground", "air"],
  },
  {
    id: "mortar",
    name: "Mortar",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 3,
    attackRange: 11,
    damageType: "splash",
    targets: ["ground"],
  },
  {
    id: "air_defense",
    name: "Air Defense",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 4,
    attackRange: 10,
    damageType: "single",
    targets: ["air"],
  },
  {
    id: "wizard_tower",
    name: "Wizard Tower",
    category: "defense",
    width: 3,
    height: 3,
    minTier: 5,
    attackRange: 7,
    damageType: "splash",
    targets: ["ground", "air"],
  },
  {
    id: "gold_storage",
    name: "Gold Storage",
    category: "storage",
    width: 3,
    height: 3,
    minTier: 1,
  },
  {
    id: "elixir_storage",
    name: "Elixir Storage",
    category: "storage",
    width: 3,
    height: 3,
    minTier: 1,
  },
  {
    id: "army_camp",
    name: "Army Camp",
    category: "army",
    width: 4,
    height: 4,
    minTier: 1,
  },
  { id: "bomb", name: "Bomb", category: "trap", width: 1, height: 1, minTier: 3 },
];

export const storyCatalog: BuildingCatalog = new InMemoryBuildingCatalog(STORY_DEFS);

export const storyRuleSet: RuleSet = (() => {
  const parsed = parseRulePack({
    tier: 8,
    gridSize: 44,
    walls: 225,
    required: [{ id: "town_hall", min: 1, max: 1 }],
    buildings: STORY_DEFS.map((d) => ({ id: d.id, maxCount: 6 })),
  });
  if (!parsed.ok) throw new Error("story rule pack invalid");
  return buildRuleSet(parsed.value);
})();
