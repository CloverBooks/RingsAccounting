/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared-ui": path.resolve(__dirname, "../shared-ui/src"),
    },
    // Ensure all shared-ui dependencies resolve from admin's node_modules
    dedupe: ["react", "react-dom", "framer-motion", "lucide-react"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "framer-motion", "lucide-react"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router-dom/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/framer-motion/") || id.includes("/lucide-react/")) {
            return "motion-icons";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // Forward API requests to Rust backend
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
