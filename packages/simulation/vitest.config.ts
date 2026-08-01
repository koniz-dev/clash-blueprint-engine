import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "simulation",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
