import { recommendImprovements, type AiReport } from "@clash/ai";
import {
  InMemoryBuildingCatalog,
  Village,
  type BuildingDefinition,
  type VillageSnapshot,
} from "@clash/engine";

interface AiRequest {
  snapshot: VillageSnapshot;
  definitions: BuildingDefinition[];
}
type AiResponse = { report: AiReport } | { error: string };

// Runs the AI recommendation (which simulates attacks from every side) off the
// main thread, so the editor stays responsive while it computes.
self.onmessage = (event: MessageEvent<AiRequest>) => {
  const post = (response: AiResponse): void => (self as unknown as Worker).postMessage(response);

  const { snapshot, definitions } = event.data;
  const catalog = new InMemoryBuildingCatalog(definitions);
  const rebuilt = Village.fromSnapshot(snapshot, catalog);
  if (!rebuilt.ok) {
    post({ error: "Failed to rebuild village from snapshot" });
    return;
  }

  const report = recommendImprovements(rebuilt.value, catalog, {
    probeOptions: { maxSeconds: 45 },
  });
  post({ report });
};
