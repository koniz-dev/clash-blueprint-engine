import type { VillageSnapshot } from "@clash/engine";
import { err, ok, type Result } from "@clash/shared";

/**
 * The persisted save-format lives here — at the serialization boundary — so the
 * engine's {@link VillageSnapshot} can stay the canonical *current* in-memory
 * shape with no version field (keeping the core pure). Everything that writes a
 * layout to text (the JSON exporter, the editor's autosave) stamps the current
 * version; everything that reads one (the JSON importer, autosave restore) runs
 * it forward through the migration chain before the aggregate is rebuilt.
 */

/**
 * Current on-disk format version. A monotonic integer: each bump ships a
 * `migrate(v → v+1)` step in {@link MIGRATIONS}. Bump this whenever the
 * persisted shape changes structurally.
 */
export const CURRENT_SAVE_VERSION = 1;

/** The versioned wrapper actually written to disk / localStorage. */
export interface PersistedLayout {
  readonly formatVersion: number;
  readonly snapshot: VillageSnapshot;
}

/** Why a save file could not be read. Surfaced as a `Result`, never thrown. */
export interface SaveFormatError {
  readonly kind: "PARSE" | "UNSUPPORTED_VERSION" | "CORRUPT";
  readonly issues: ReadonlyArray<string>;
}

type RawObject = Record<string, unknown>;
type Migration = (data: RawObject) => RawObject;

/**
 * Ordered forward migrations, keyed by the version they upgrade *from*. Version
 * 0 is the pre-versioning era (a bare snapshot with no `formatVersion`); its
 * step also folds the historical `townHall → tier` rename.
 */
const MIGRATIONS: Record<number, Migration> = {
  0: (data) => {
    const { townHall, ...rest } = data;
    return { ...rest, tier: data.tier ?? townHall };
  },
};

function isRecord(value: unknown): value is RawObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stamp the current version onto a snapshot for persistence. */
export function stampVersion(snapshot: VillageSnapshot): PersistedLayout {
  return { formatVersion: CURRENT_SAVE_VERSION, snapshot };
}

/** Serialize a snapshot to a versioned JSON string (trailing newline). */
export function serializeLayout(snapshot: VillageSnapshot): string {
  return `${JSON.stringify(stampVersion(snapshot), null, 2)}\n`;
}

/**
 * Detect a raw parsed layout's version and migrate it forward to the current
 * shape. Returns the migrated *bare snapshot* object (still structurally
 * unvalidated — the importer/engine validate and rebuild it). Unknown/too-new
 * versions and non-objects fail as a `Result` error, never a throw.
 */
export function migrateToCurrent(raw: unknown): Result<RawObject, SaveFormatError> {
  if (!isRecord(raw)) {
    return err({ kind: "CORRUPT", issues: ["root must be an object"] });
  }

  const versionField = raw.formatVersion;
  const version = versionField === undefined ? 0 : versionField;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    return err({ kind: "CORRUPT", issues: [`invalid formatVersion: ${String(versionField)}`] });
  }
  if (version > CURRENT_SAVE_VERSION) {
    return err({
      kind: "UNSUPPORTED_VERSION",
      issues: [
        `save format version ${version} is newer than this app supports (${CURRENT_SAVE_VERSION}); update the app to open it`,
      ],
    });
  }

  // Legacy (v0) payloads are the bare snapshot; versioned payloads nest it.
  const candidate = version === 0 ? raw : raw.snapshot;
  if (!isRecord(candidate)) {
    return err({ kind: "CORRUPT", issues: ["missing snapshot payload"] });
  }

  let payload: RawObject = candidate;
  for (let v = version; v < CURRENT_SAVE_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (!step) {
      return err({
        kind: "UNSUPPORTED_VERSION",
        issues: [`no migration registered from version ${v}`],
      });
    }
    payload = step(payload);
  }
  return ok(payload);
}

/** Parse a save-file string (JSON) and migrate it to the current shape. */
export function parseSaveFile(text: string): Result<RawObject, SaveFormatError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return err({ kind: "PARSE", issues: [error instanceof Error ? error.message : String(error)] });
  }
  return migrateToCurrent(raw);
}
