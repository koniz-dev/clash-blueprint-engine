import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "example-pipeline",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
