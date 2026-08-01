import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  findConflicts,
  formatCombo,
  resolveShortcut,
  type ShortcutGroup,
} from "./shortcuts";

const GROUPS: ShortcutGroup[] = ["Edit", "Selection", "Tools", "View"];

describe("shortcut registry", () => {
  it("has no conflicting key bindings", () => {
    expect(findConflicts()).toEqual([]);
  });

  it("every shortcut is well-formed", () => {
    const ids = new Set<string>();
    for (const s of SHORTCUTS) {
      expect(s.id).toBeTruthy();
      expect(ids.has(s.id)).toBe(false); // unique ids
      ids.add(s.id);
      expect(s.label).toBeTruthy();
      expect(GROUPS).toContain(s.group);
      expect(s.keys.length).toBeGreaterThan(0);
      for (const combo of s.keys) expect(combo.key).toBe(combo.key.toLowerCase());
    }
  });
});

describe("resolveShortcut — preserves the original bindings", () => {
  const cases: Array<[string, Parameters<typeof resolveShortcut>[0]]> = [
    ["undo", { key: "z", metaKey: true }],
    ["redo", { key: "z", metaKey: true, shiftKey: true }],
    ["redo", { key: "y", ctrlKey: true }],
    ["copy", { key: "c", metaKey: true }],
    ["paste", { key: "v", metaKey: true }],
    ["delete-selection", { key: "Delete" }],
    ["delete-selection", { key: "Backspace" }],
    ["nudge", { key: "ArrowUp" }],
    // New hotkeys.
    ["tool-select", { key: "v" }],
    ["tool-select", { key: "1" }],
    ["tool-place", { key: "p" }],
    ["tool-wall", { key: "w" }],
    ["tool-delete", { key: "d" }],
    ["tool-delete", { key: "4" }],
    ["rotate", { key: "r" }],
    ["help", { key: "/", shiftKey: true }],
  ];

  for (const [id, event] of cases) {
    it(`${JSON.stringify(event)} → ${id}`, () => {
      expect(resolveShortcut(event)?.id).toBe(id);
    });
  }

  it("does not hijack Ctrl/⌘ combos for plain-key tools", () => {
    // Ctrl+V is paste, never the Select tool; Ctrl+R stays a browser refresh.
    expect(resolveShortcut({ key: "v", ctrlKey: true })?.id).toBe("paste");
    expect(resolveShortcut({ key: "r", ctrlKey: true })).toBeUndefined();
  });

  it("does not match a plain letter as undo/redo", () => {
    expect(resolveShortcut({ key: "z" })).toBeUndefined();
  });
});

describe("formatCombo", () => {
  it("renders ⌘ on macOS and Ctrl elsewhere", () => {
    expect(formatCombo({ key: "z", mod: true }, true)).toBe("⌘Z");
    expect(formatCombo({ key: "z", mod: true }, false)).toBe("Ctrl+Z");
    expect(formatCombo({ key: "z", mod: true, shift: true }, true)).toBe("⌘⇧Z");
  });

  it("renders the help combo as ?", () => {
    expect(formatCombo({ key: "/", shift: true }, true)).toBe("?");
  });

  it("renders arrow glyphs and plain keys", () => {
    expect(formatCombo({ key: "arrowup" }, false)).toBe("↑");
    expect(formatCombo({ key: "v", mod: false }, false)).toBe("V");
  });
});
