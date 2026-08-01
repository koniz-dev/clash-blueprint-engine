import { createSequentialIdGenerator, type IdGenerator } from "@clash/shared";
import type { BuildingDefinition } from "../domain/building-definition.js";
import { InMemoryBuildingCatalog } from "../domain/building-definition.js";

/**
 * Minimal building catalog for tests and examples. Not game-accurate — real
 * data lives in `data/buildings/`. Includes a 4×4 Town Hall, a 3×3 Cannon and
 * a 3×2 Air Defense so rotation (axis-swap) is exercised.
 */
export const TEST_DEFINITIONS: readonly BuildingDefinition[] = [
  {
    id: "town_hall",
    name: "Town Hall",
    category: "townhall",
    width: 4,
    height: 4,
    minTier: 1,
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
    id: "air_defense",
    name: "Air Defense",
    category: "defense",
    width: 3,
    height: 2,
    minTier: 4,
    attackRange: 10,
    damageType: "single",
    targets: ["air"],
  },
];

export function createTestCatalog(): InMemoryBuildingCatalog {
  return new InMemoryBuildingCatalog(TEST_DEFINITIONS);
}

/** Deterministic id generator so entity ids are stable across test runs. */
export function createTestIds(prefix = "t"): IdGenerator {
  return createSequentialIdGenerator(prefix);
}
