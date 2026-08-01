export { EditorApp, type EditorAppProps } from "./EditorApp";
export {
  useEditor,
  type EditorController,
  type EditorTemplate,
  type UseEditorOptions,
  type Tool,
  type ViewMode,
} from "./useEditor";
export { EditorCanvas } from "./EditorCanvas";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { HistoryPanel } from "./HistoryPanel";
export { LanguageSwitcher } from "./LanguageSwitcher";
export {
  I18nProvider,
  useI18n,
  LOCALES,
  type Locale,
  type MessageKey,
  type Messages,
} from "./i18n";
export { ReplayPanel } from "./ReplayPanel";
export { ShortcutsOverlay, type ShortcutsOverlayProps } from "./ShortcutsOverlay";
export { SHORTCUTS, GESTURES, type Shortcut, type ShortcutGroup, type Gesture } from "./shortcuts";
export { Toolbar } from "./Toolbar";
export { BuildingLibrary } from "./BuildingLibrary";
export {
  Inspector,
  StatsPanel,
  ValidationPanel,
  AnalysisPanel,
  AiPanel,
  EventLogPanel,
} from "./Panels";
