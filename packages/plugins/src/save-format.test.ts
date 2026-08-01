import { describe, expect, it } from "vitest";
import type { VillageSnapshot } from "@clash/engine";
import {
  CURRENT_SAVE_VERSION,
  migrateToCurrent,
  parseSaveFile,
  serializeLayout,
  stampVersion,
} from "./save-format.js";

const snapshot: VillageSnapshot = {
  grid: { width: 44, height: 44 },
  tier: 8,
  buildings: [],
  walls: [],
};

describe("save-format serialization", () => {
  it("stamps the current version", () => {
    expect(stampVersion(snapshot)).toEqual({ formatVersion: CURRENT_SAVE_VERSION, snapshot });
  });

  it("round-trips a current-version payload", () => {
    const text = serializeLayout(snapshot);
    const parsed = JSON.parse(text);
    expect(parsed.formatVersion).toBe(CURRENT_SAVE_VERSION);

    const migrated = migrateToCurrent(parsed);
    expect(migrated.ok).toBe(true);
    if (migrated.ok) expect(migrated.value).toEqual(snapshot);
  });
});

describe("migration", () => {
  it("migrates an OLD unversioned (v0) payload forward and loads it", () => {
    // A pre-versioning save: a bare snapshot with the legacy `townHall` field.
    const legacy = { grid: { width: 44, height: 44 }, townHall: 9, buildings: [], walls: [] };
    const migrated = migrateToCurrent(legacy);
    expect(migrated.ok).toBe(true);
    if (migrated.ok) {
      // `townHall` folded into `tier`; the current shape emerges.
      expect(migrated.value.tier).toBe(9);
      expect(migrated.value).not.toHaveProperty("townHall");
      expect(migrated.value.grid).toEqual({ width: 44, height: 44 });
    }
  });

  it("prefers an explicit tier over a legacy townHall if both are present", () => {
    const migrated = migrateToCurrent({ grid: {}, tier: 5, townHall: 9, buildings: [], walls: [] });
    expect(migrated.ok && migrated.value.tier).toBe(5);
  });

  it("rejects a too-new version cleanly", () => {
    const result = migrateToCurrent({ formatVersion: CURRENT_SAVE_VERSION + 1, snapshot });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("UNSUPPORTED_VERSION");
  });

  it("rejects a corrupt payload cleanly", () => {
    expect(migrateToCurrent(42).ok).toBe(false);
    const noSnapshot = migrateToCurrent({ formatVersion: CURRENT_SAVE_VERSION });
    expect(noSnapshot.ok).toBe(false);
    if (!noSnapshot.ok) expect(noSnapshot.error.kind).toBe("CORRUPT");
  });

  it("rejects an invalid formatVersion", () => {
    const result = migrateToCurrent({ formatVersion: "1.0", snapshot });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("CORRUPT");
  });
});

describe("parseSaveFile", () => {
  it("parses and migrates a serialized layout", () => {
    const parsed = parseSaveFile(serializeLayout(snapshot));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toEqual(snapshot);
  });

  it("returns a PARSE error on non-JSON", () => {
    const parsed = parseSaveFile("{ not json");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.kind).toBe("PARSE");
  });
});
