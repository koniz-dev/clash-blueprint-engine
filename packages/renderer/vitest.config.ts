import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "renderer",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
