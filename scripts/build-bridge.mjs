import { build } from "vite";
await build({
  configFile: false,
  build: {
    outDir: "dist/bridge",
    emptyOutDir: true,
    lib: {
      entry: "src/browser/bridge/index.ts",
      name: "RuyiDesignReviewBridge",
      formats: ["iife"],
      fileName: () => "bridge.js",
    },
  },
});
