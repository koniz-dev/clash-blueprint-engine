/**
 * Display theme for building categories. Categories are an open, data-defined
 * set, so lookups fall back gracefully for any category a game introduces:
 * an unknown category still gets a stable color, a legible symbol and a
 * humanized label. A game pack can override these, but the renderer never
 * breaks on a category it hasn't seen.
 */

/** Built-in defaults for the common categories (used by the first game pack). */
const KNOWN_COLORS: Readonly<Record<string, string>> = {
  townhall: "#2e7d32",
  defense: "#c62828",
  resource: "#f9a825",
  storage: "#6a1b9a",
  army: "#1565c0",
  trap: "#ef6c00",
  wall: "#546e7a",
};

const KNOWN_SYMBOLS: Readonly<Record<string, string>> = {
  townhall: "H",
  defense: "D",
  resource: "R",
  storage: "S",
  army: "A",
  trap: "T",
  wall: "#",
};

const KNOWN_LABELS: Readonly<Record<string, string>> = {
  townhall: "Town Hall",
  defense: "Defense",
  resource: "Resource",
  storage: "Storage",
  army: "Army",
  trap: "Trap",
  wall: "Wall",
};

/** Deterministic palette for categories with no explicit color. */
const FALLBACK_PALETTE: readonly string[] = [
  "#00838f",
  "#5d4037",
  "#00695c",
  "#ad1457",
  "#4527a0",
  "#37474f",
  "#9e9d24",
];

const KNOWN_ORDER: readonly string[] = [
  "townhall",
  "defense",
  "resource",
  "storage",
  "army",
  "trap",
  "wall",
];

export const EMPTY_SYMBOL = ".";
export const WALL_SYMBOL = KNOWN_SYMBOLS.wall ?? "#";
export const WALL_COLOR = KNOWN_COLORS.wall ?? "#546e7a";

function hashIndex(value: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % buckets;
}

function humanize(category: string): string {
  return category
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** A stable display color for any category, known or not. */
export function categoryColor(category: string): string {
  return KNOWN_COLORS[category] ?? FALLBACK_PALETTE[hashIndex(category, FALLBACK_PALETTE.length)]!;
}

/** A single-character symbol for any category. */
export function categorySymbol(category: string): string {
  return KNOWN_SYMBOLS[category] ?? (category.charAt(0).toUpperCase() || "?");
}

/** A human-readable label for any category. */
export function categoryLabel(category: string): string {
  return KNOWN_LABELS[category] ?? humanize(category);
}

/** Sort key placing well-known categories first, then anything else. */
export function categoryOrder(category: string): number {
  const index = KNOWN_ORDER.indexOf(category);
  return index === -1 ? KNOWN_ORDER.length : index;
}
