import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
    minify: "esbuild",
  },
  server: {
    open: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "zustand", "dexie"],
  },
});