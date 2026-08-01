/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16's on-screen Dev Tools button ("Open Next.js Dev Tools") otherwise
  // collides with the editor's own "Open" menu in tests and overlays the canvas.
  devIndicators: false,
  // Our workspace packages ship TypeScript from `src`; Next transpiles them.
  transpilePackages: [
    "@clash/shared",
    "@clash/engine",
    "@clash/plugins",
    "@clash/renderer",
    "@clash/exporter",
    "@clash/importer",
    "@clash/rules-engine",
    "@clash/analyzer",
    "@clash/simulation",
    "@clash/ai",
    "@clash/ui",
    "konva",
    "react-konva",
  ],
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    // Konva optionally references the native `canvas` module (server-side
    // rasterization); the editor is client-only, so stub it out.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    // Our workspace TS uses ESM-correct `.js` import specifiers that point at
    // `.ts` sources. tsc/esbuild rewrite these; teach webpack to as well.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
