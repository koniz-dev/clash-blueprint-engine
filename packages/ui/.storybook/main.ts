import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  async viteFinal(viteConfig) {
    viteConfig.plugins = viteConfig.plugins ?? [];
    // The workspace ships TypeScript with ESM-correct `.js` import specifiers
    // pointing at `.ts` sources. Teach Vite (like tsc/webpack) to resolve them.
    viteConfig.plugins.push({
      name: "clash-js-to-ts",
      enforce: "pre",
      async resolveId(source, importer) {
        if (importer && source.startsWith(".") && source.endsWith(".js")) {
          const resolved = await this.resolve(`${source.slice(0, -3)}.ts`, importer, {
            skipSelf: true,
          });
          if (resolved) return resolved;
        }
        return null;
      },
    });
    return viteConfig;
  },
};

export default config;
