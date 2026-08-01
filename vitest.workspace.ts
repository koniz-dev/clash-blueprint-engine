import { defineWorkspace } from "vitest/config";

// Aggregates every package's own Vitest project so `pnpm test` at the root
// can run the whole suite, while each package remains independently testable.
export default defineWorkspace(["packages/*"]);
