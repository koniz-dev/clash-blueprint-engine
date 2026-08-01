import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "ui",
    include: ["src/**/*.test.{ts,tsx}"],
    // Node is the default (fast) env; hook tests opt into jsdom via a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    // A real origin so jsdom provides a working `localStorage` (opaque origins
    // like about:blank don't); the setup file backfills one if it's still absent.
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      // Gate the framework-agnostic *logic* modules. Presentational .tsx
      // components are covered by Storybook + Playwright e2e, not unit coverage.
      include: ["src/hooks/**/*.ts", "src/shortcuts.ts", "src/canvas-geometry.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
