import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "importer",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
