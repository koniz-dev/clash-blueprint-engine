"use client";

import { EditorApp } from "@clash/ui";
import { analyzeWithWorker } from "../lib/ai-client";
import {
  catalog,
  gridSize,
  persistKey,
  ruleSet,
  rules,
  templates,
  tier,
  tierLabel,
} from "../lib/data";

export default function EditorClient(): JSX.Element {
  return (
    <EditorApp
      catalog={catalog}
      ruleSet={ruleSet}
      gridSize={gridSize}
      tier={tier}
      tierLabel={tierLabel}
      rules={rules}
      templates={templates}
      persistKey={persistKey}
      analyzeAsync={analyzeWithWorker}
    />
  );
}
