/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const reportPath = process.env.BUNDLE_REPORT;
  const shouldAnalyze = mode === "analyze" || Boolean(reportPath);

  return {
    plugins: [
      react(),
      ...(shouldAnalyze
        ? [
            visualizer({
              filename:
                reportPath ||
                path.resolve(__dirname, "../../docs/perf/bundle-report.html"),
              template: "treemap",
              gzipSize: true,
              brotliSize: true,
              open: false,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@shared-ui": path.resolve(__dirname, "../shared-ui/src"),
      },
      // Ensure all shared-ui dependencies resolve from customer's node_modules
      dedupe: ["react", "react-dom", "framer-motion", "lucide-react"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "framer-motion", "lucide-react", "recharts"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      commonjsOptions: {
        include: [/node_modules/],
      },
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
            if (id.includes("/recharts/")) {
              return "charts";
            }
            return undefined;
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
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
      setupFiles: "./src/test/setupTests.ts",
      testTimeout: 15000,
      hookTimeout: 15000,
    },
  };
});
