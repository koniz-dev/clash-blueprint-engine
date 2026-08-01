/**
 * English message catalog — the source of truth for message keys. Other locales
 * implement the same `Messages` shape, so a missing or misspelled key is a
 * compile error, not a silent fallback. Keys are dotted by area.
 */
export const en = {
  "lang.label": "Language",
  "lang.en": "English",
  "lang.vi": "Tiếng Việt",

  "toolbar.new": "New",
  "toolbar.open": "Open",
  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "toolbar.validate": "Validate",
  "toolbar.analyze": "Analyze",
  "toolbar.aiSuggest": "AI Suggest",
  "toolbar.aiAnalyzing": "Analyzing…",
  "toolbar.exportJson": "Export JSON",
  "toolbar.exportAscii": "Export ASCII",
  "toolbar.exportPng": "Export PNG",
  "toolbar.exportGltf": "Export glTF",
  "toolbar.help": "Help",

  "view.2d": "2D",
  "view.3d": "3D",

  "tool.select": "Select",
  "tool.place": "Place",
  "tool.wall": "Wall",
  "tool.delete": "Delete",
  "tool.hand": "Hand",
  "tool.select.hint": "Select & inspect buildings",
  "tool.place.hint": "Place the chosen building",
  "tool.wall.hint": "Paint walls (drag)",
  "tool.delete.hint": "Remove buildings & walls",
  "tool.hand.hint": "Pan the canvas (drag)",

  "panel.buildings": "Buildings",
  "panel.inspector": "Inspector",
  "panel.history": "History",
  "panel.replay": "Attack Replay",
  "panel.stats": "Statistics",
  "panel.validation": "Validation",
  "panel.analysis": "Defense Score",
  "panel.ai": "AI Suggestions",
  "panel.log": "Event Log",
} as const;

/** Every valid message key. */
export type MessageKey = keyof typeof en;

/** A complete catalog for a locale — must define every key. */
export type Messages = Record<MessageKey, string>;
