import { defineConfig } from "vite";
export default defineConfig({
  root: "src/browser/workspace",
  base: "/",
  build: { outDir: "../../../dist/workspace", emptyOutDir: true },
});
