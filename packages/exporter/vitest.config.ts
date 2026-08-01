import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "exporter",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
