import type { AiReport } from "@clash/ai";
import type { BuildingDefinition, VillageSnapshot } from "@clash/engine";

type AiResponse = { report: AiReport } | { error: string };

/**
 * Run the AI recommendation in a Web Worker. A fresh worker per call keeps the
 * plumbing trivial (no request multiplexing) — AI runs are user-initiated and
 * infrequent. Matches the `AnalyzeAsync` contract that `@clash/ui` expects.
 */
export function analyzeWithWorker(input: {
  snapshot: VillageSnapshot;
  definitions: BuildingDefinition[];
}): Promise<AiReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../app/ai.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      worker.terminate();
      if ("error" in event.data) reject(new Error(event.data.error));
      else resolve(event.data.report);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || "AI worker error"));
    };
    worker.postMessage(input);
  });
}
