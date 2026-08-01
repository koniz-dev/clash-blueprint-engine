import { useCallback, useState } from "react";
import type { BuildingCatalog, BuildingDefinition, GameRules, VillageEditor } from "@clash/engine";
import { ValidationEngine, type RuleSet, type ValidationReport } from "@clash/rules-engine";
import { analyzeLayout, type DefenseScore } from "@clash/analyzer";
import { recommendImprovements, type AiReport } from "@clash/ai";
import type { VillageSnapshot } from "@clash/engine";
import type { PushLog } from "./useLog";

/** Off-thread AI runner (e.g. a Web Worker). Keeps `@clash/ui` worker-agnostic. */
export type AnalyzeAsync = (input: {
  snapshot: VillageSnapshot;
  definitions: BuildingDefinition[];
}) => Promise<AiReport>;

/**
 * On-demand read models — validation, defense analysis and AI recommendations —
 * stored in React state for the side panels. These are *queries*: they never
 * mutate the village. `reset` clears them (called when a new layout loads).
 */
export function useQueries(
  editor: VillageEditor,
  catalog: BuildingCatalog,
  rules: GameRules,
  ruleSet: RuleSet | undefined,
  analyzeAsync: AnalyzeAsync | undefined,
  pushLog: PushLog,
) {
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [analysis, setAnalysis] = useState<DefenseScore | null>(null);
  const [ai, setAi] = useState<AiReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runValidation = useCallback(() => {
    if (!ruleSet) {
      pushLog("info", "No rule set loaded");
      return;
    }
    const report = new ValidationEngine().validateAndRecord(
      editor.village,
      ruleSet,
      catalog,
      editor.events,
      rules,
    );
    setValidation(report);
    pushLog("info", `Validation: ${report.errors} errors, ${report.warnings} warnings`);
  }, [editor, ruleSet, catalog, rules, pushLog]);

  const runAnalysis = useCallback(() => {
    const score = analyzeLayout(editor.village, catalog, rules);
    setAnalysis(score);
    pushLog("info", `Defense score ${score.overall} (grade ${score.grade})`);
  }, [editor, catalog, rules, pushLog]);

  const runAi = useCallback(async () => {
    const applyReport = (report: AiReport): void => {
      setAi(report);
      setAnalysis(report.defenseScore);
      pushLog("info", `AI: ${report.recommendations.length} recommendations`);
    };

    if (analyzeAsync) {
      // Off-thread: the heavy attack simulations don't block the UI.
      setAiLoading(true);
      pushLog("info", "Running AI analysis…");
      try {
        const report = await analyzeAsync({
          snapshot: editor.village.toSnapshot(),
          definitions: [...catalog.all()],
        });
        applyReport(report);
      } catch (error) {
        pushLog("error", `AI failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    // Synchronous fallback (tests, non-worker hosts).
    applyReport(
      recommendImprovements(editor.village, catalog, { probeOptions: { maxSeconds: 45 }, rules }),
    );
  }, [editor, catalog, analyzeAsync, rules, pushLog]);

  const reset = useCallback(() => {
    setValidation(null);
    setAnalysis(null);
    setAi(null);
  }, []);

  return {
    validation,
    analysis,
    ai,
    aiLoading,
    setAnalysis,
    runValidation,
    runAnalysis,
    runAi,
    reset,
  };
}
