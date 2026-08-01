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

  "app.loading3d": "Loading 3D view…",

  // Shared action buttons
  "action.copy": "Copy",
  "action.delete": "Delete",
  "action.deleteAll": "Delete all",
  "action.rotate": "Rotate",

  // Inspector
  "inspector.multiSelected": "{count} buildings selected.",
  "inspector.empty":
    "Select a building to inspect it. Shift-click to multi-select; ⌘/Ctrl+C / V to copy & paste.",
  "inspector.name": "Name",
  "inspector.position": "Position",
  "inspector.rotation": "Rotation",

  // Statistics
  "stats.buildings": "Buildings",
  "stats.walls": "Walls",

  // Validation
  "validation.empty": "Run “Validate” to check the layout.",
  "validation.ok": "No issues — layout is valid.",

  // Defense score
  "analysis.empty": "Run “Analyze” for a defensive breakdown.",

  // AI suggestions
  "ai.loading": "Analyzing (simulating attacks)…",
  "ai.empty": "Run “AI Suggest” for ranked improvements.",
  "ai.none": "No improvements found — solid base!",
  "ai.applyMove": "Apply move",

  // History
  "history.empty": "No actions yet — place a building to start.",

  // Attack replay
  "replay.intro": "Deploy troops, then play a deterministic attack.",
  "replay.deploy": "Deploy",
  "replay.deploying": "Deploying…",
  "replay.placed": "{count} placed",
  "replay.clear": "Clear",
  "replay.play": "▶ Play Attack",
  "replay.result": "Result",
  "replay.pause": "⏸ Pause",
  "replay.resume": "▶ Play",
  "replay.time": "Replay time",
  "replay.exit": "Exit",

  // Open menu
  "open.button": "Open",
  "open.templates": "Templates",
  "open.file": "File",
  "open.import": "Import JSON…",

  // Confirm dialog
  "confirm.discard": "Discard & continue",
  "confirm.cancel": "Cancel",
  "discard.new": "Start a new layout? Your current layout will be replaced.",
  "discard.open": "Open “{name}”? Your current layout will be replaced.",

  // Building library
  "library.search": "Search buildings…",
  "library.noMatch": "No buildings match “{query}”.",

  // Help overlay
  "help.title": "Keyboard shortcuts",
  "help.close": "Close",
  "help.closeAria": "Close shortcuts",
  "help.mouse": "Mouse",
  "group.Edit": "Edit",
  "group.Selection": "Selection",
  "group.Tools": "Tools",
  "group.View": "View",

  // Shortcut labels (rendered in the help overlay)
  "shortcut.undo": "Undo",
  "shortcut.redo": "Redo",
  "shortcut.copy": "Copy selection",
  "shortcut.paste": "Paste",
  "shortcut.delete-selection": "Delete selection",
  "shortcut.nudge": "Nudge selection",
  "shortcut.rotate": "Rotate selection",
  "shortcut.tool-select": "Select tool",
  "shortcut.tool-place": "Place tool",
  "shortcut.tool-wall": "Wall tool",
  "shortcut.tool-delete": "Delete tool",
  "shortcut.tool-hand": "Hand tool (pan)",
  "shortcut.help": "Show shortcuts",

  // Mouse gestures (label = trigger, hint = effect)
  "gesture.marquee.label": "Drag (empty space)",
  "gesture.marquee.hint": "Marquee-select",
  "gesture.move.label": "Drag a building",
  "gesture.move.hint": "Move it (one undo)",
  "gesture.shift.label": "Shift + click",
  "gesture.shift.hint": "Add / remove from selection",
  "gesture.pan.label": "Space + drag",
  "gesture.pan.hint": "Pan the canvas",
  "gesture.wheel.label": "Mouse wheel",
  "gesture.wheel.hint": "Zoom around the cursor",

  // Building categories
  "category.defense": "Defense",
  "category.resource": "Resource",
  "category.storage": "Storage",
  "category.army": "Army",
  "category.trap": "Trap",
  "category.wall": "Wall",
  "category.townhall": "Town Hall",
} as const;

/** Every valid message key. */
export type MessageKey = keyof typeof en;

/** A complete catalog for a locale — must define every key. */
export type Messages = Record<MessageKey, string>;
