import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "plugins",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
