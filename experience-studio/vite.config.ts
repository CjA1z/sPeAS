import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "../Deno/admin/experience-studio"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        studio: resolve(__dirname, "src/studio/main.tsx"),
        publicRuntime: resolve(__dirname, "src/public-runtime/main.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "style.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
