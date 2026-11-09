import { defineConfig } from "vite";
export default defineConfig({
  root: "src/browser/workspace",
  base: "/",
  publicDir: "../assets",
  build: { outDir: "../../../dist/workspace", emptyOutDir: true },
});
