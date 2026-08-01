import type { MessageKey } from "./i18n";
import type { Tool } from "./useEditor";

/**
 * The single source of truth for keyboard shortcuts. The keydown handler in
 * `useEditor` dispatches from this list, and the help overlay + toolbar tooltips
 * render from it — so a binding is defined exactly once and the two can never
 * drift. This module is pure presentation/config: it imports no engine or domain
 * code — only UI-layer types (`Tool`, `MessageKey`), which are erased at runtime.
 */

export type ShortcutGroup = "Edit" | "Selection" | "Tools" | "View";

/**
 * One trigger. `mod` means ⌘ (macOS) or Ctrl. For each of `mod`/`shift`:
 * `true` requires it, `false` forbids it, `undefined` ignores it — which lets us
 * reproduce the original handler's behavior byte-for-byte (e.g. delete/arrows
 * never checked modifiers).
 */
export interface KeyCombo {
  readonly key: string;
  readonly mod?: boolean;
  readonly shift?: boolean;
}

/** The minimal surface the shortcuts drive — built from controller actions. */
export interface ShortcutContext {
  readonly selectionCount: number;
  undo(): void;
  redo(): void;
  copy(): void;
  paste(): void;
  deleteSelection(): void;
  nudge(dx: number, dy: number): void;
  setTool(tool: Tool): void;
  rotate(): void;
  toggleHelp(): void;
}

export interface Shortcut {
  readonly id: string;
  /** i18n key for the human label (rendered, translated, in the help overlay). */
  readonly label: MessageKey;
  readonly group: ShortcutGroup;
  readonly keys: readonly KeyCombo[];
  /** Whether a match calls `preventDefault()` (matches the original handler). */
  readonly preventDefault?: boolean;
  /** Optional guard; the shortcut only fires (and preventDefaults) when true. */
  readonly when?: (ctx: ShortcutContext) => boolean;
  /** Dispatch. `key` is the normalized matched key (used by nudge for direction). */
  readonly run: (ctx: ShortcutContext, key: string) => void;
}

const hasSelection = (ctx: ShortcutContext): boolean => ctx.selectionCount > 0;

const NUDGE: Record<string, { x: number; y: number }> = {
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
};

/**
 * The registry. Edit/Selection reproduce the pre-existing bindings exactly;
 * Tools/View add the new hotkeys. Number keys 1–4 mirror V/P/W/D as a second
 * combo on the same tool row.
 */
export const SHORTCUTS: readonly Shortcut[] = [
  // --- Edit ---------------------------------------------------------------
  {
    id: "undo",
    label: "shortcut.undo",
    group: "Edit",
    keys: [{ key: "z", mod: true, shift: false }],
    preventDefault: true,
    run: (c) => c.undo(),
  },
  {
    id: "redo",
    label: "shortcut.redo",
    group: "Edit",
    keys: [
      { key: "z", mod: true, shift: true },
      { key: "y", mod: true },
    ],
    preventDefault: true,
    run: (c) => c.redo(),
  },
  {
    id: "copy",
    label: "shortcut.copy",
    group: "Edit",
    keys: [{ key: "c", mod: true }],
    run: (c) => c.copy(),
  },
  {
    id: "paste",
    label: "shortcut.paste",
    group: "Edit",
    keys: [{ key: "v", mod: true }],
    run: (c) => c.paste(),
  },

  // --- Selection ----------------------------------------------------------
  {
    id: "delete-selection",
    label: "shortcut.delete-selection",
    group: "Selection",
    keys: [{ key: "delete" }, { key: "backspace" }],
    preventDefault: true,
    when: hasSelection,
    run: (c) => c.deleteSelection(),
  },
  {
    id: "nudge",
    label: "shortcut.nudge",
    group: "Selection",
    keys: [{ key: "arrowup" }, { key: "arrowdown" }, { key: "arrowleft" }, { key: "arrowright" }],
    preventDefault: true,
    when: hasSelection,
    run: (c, key) => {
      const d = NUDGE[key];
      if (d) c.nudge(d.x, d.y);
    },
  },
  {
    id: "rotate",
    label: "shortcut.rotate",
    group: "Selection",
    keys: [{ key: "r", mod: false }],
    run: (c) => c.rotate(),
  },

  // --- Tools (letter + mirrored number) -----------------------------------
  {
    id: "tool-select",
    label: "shortcut.tool-select",
    group: "Tools",
    keys: [
      { key: "v", mod: false },
      { key: "1", mod: false },
    ],
    run: (c) => c.setTool("select"),
  },
  {
    id: "tool-place",
    label: "shortcut.tool-place",
    group: "Tools",
    keys: [
      { key: "p", mod: false },
      { key: "2", mod: false },
    ],
    run: (c) => c.setTool("place"),
  },
  {
    id: "tool-wall",
    label: "shortcut.tool-wall",
    group: "Tools",
    keys: [
      { key: "w", mod: false },
      { key: "3", mod: false },
    ],
    run: (c) => c.setTool("wall"),
  },
  {
    id: "tool-delete",
    label: "shortcut.tool-delete",
    group: "Tools",
    keys: [
      { key: "d", mod: false },
      { key: "4", mod: false },
    ],
    run: (c) => c.setTool("delete"),
  },
  {
    id: "tool-hand",
    label: "shortcut.tool-hand",
    group: "Tools",
    keys: [
      { key: "h", mod: false },
      { key: "5", mod: false },
    ],
    run: (c) => c.setTool("hand"),
  },

  // --- View ---------------------------------------------------------------
  {
    id: "help",
    label: "shortcut.help",
    group: "View",
    keys: [{ key: "/", mod: false, shift: true }],
    preventDefault: true,
    run: (c) => c.toggleHelp(),
  },
];

/** Mouse/pointer gestures — shown alongside the key shortcuts (display only). */
export interface Gesture {
  /** i18n key for the trigger (e.g. "Drag a building"). */
  readonly label: MessageKey;
  /** i18n key for the effect (e.g. "Move it"). */
  readonly hint: MessageKey;
}
export const GESTURES: readonly Gesture[] = [
  { label: "gesture.marquee.label", hint: "gesture.marquee.hint" },
  { label: "gesture.move.label", hint: "gesture.move.hint" },
  { label: "gesture.shift.label", hint: "gesture.shift.hint" },
  { label: "gesture.pan.label", hint: "gesture.pan.hint" },
  { label: "gesture.wheel.label", hint: "gesture.wheel.hint" },
];

/** A keyboard-event-like shape — the real `KeyboardEvent` satisfies it. */
export interface KeyLike {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
}

export function normalizeKey(key: string): string {
  return key.toLowerCase();
}

export function matchesCombo(e: KeyLike, combo: KeyCombo): boolean {
  if (normalizeKey(e.key) !== combo.key) return false;
  const mod = Boolean(e.metaKey) || Boolean(e.ctrlKey);
  if (combo.mod !== undefined && combo.mod !== mod) return false;
  if (combo.shift !== undefined && combo.shift !== Boolean(e.shiftKey)) return false;
  return true;
}

/** The first shortcut whose any combo matches the event, or undefined. */
export function resolveShortcut(
  e: KeyLike,
  shortcuts: readonly Shortcut[] = SHORTCUTS,
): Shortcut | undefined {
  return shortcuts.find((s) => s.keys.some((combo) => matchesCombo(e, combo)));
}

// --- Display helpers -------------------------------------------------------

const KEY_LABELS: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  delete: "Del",
  backspace: "⌫",
  " ": "Space",
};

/** Human label for a single combo, e.g. "⌘Z" / "Ctrl+Z" / "V" / "?". */
export function formatCombo(combo: KeyCombo, isMac: boolean): string {
  // "?" is Shift+/ — show it as the single glyph users expect.
  if (combo.key === "/" && combo.shift) return "?";
  const parts: string[] = [];
  if (combo.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (combo.shift) parts.push(isMac ? "⇧" : "Shift");
  parts.push(KEY_LABELS[combo.key] ?? combo.key.toUpperCase());
  return parts.join(isMac ? "" : "+");
}

/** All of a shortcut's combos formatted and joined, e.g. "V / 1". */
export function formatKeys(shortcut: Shortcut, isMac: boolean): string {
  return shortcut.keys.map((c) => formatCombo(c, isMac)).join(" / ");
}

/** Formatted keys for a shortcut id (for toolbar tooltips), or "". */
export function shortcutHint(id: string, isMac: boolean): string {
  const s = SHORTCUTS.find((x) => x.id === id);
  return s ? formatKeys(s, isMac) : "";
}

// --- Conflict detection (used by tests) ------------------------------------

type TriState = boolean | undefined;
const overlaps = (a: TriState, b: TriState): boolean =>
  a === undefined || b === undefined || a === b;

function combosConflict(a: KeyCombo, b: KeyCombo): boolean {
  return a.key === b.key && overlaps(a.mod, b.mod) && overlaps(a.shift, b.shift);
}

/** Pairs of shortcut ids that could both fire on the same key event. */
export function findConflicts(shortcuts: readonly Shortcut[] = SHORTCUTS): [string, string][] {
  const conflicts: [string, string][] = [];
  for (let i = 0; i < shortcuts.length; i += 1) {
    for (let j = i + 1; j < shortcuts.length; j += 1) {
      const a = shortcuts[i]!;
      const b = shortcuts[j]!;
      if (a.keys.some((ca) => b.keys.some((cb) => combosConflict(ca, cb)))) {
        conflicts.push([a.id, b.id]);
      }
    }
  }
  return conflicts;
}
