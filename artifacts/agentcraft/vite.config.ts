import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const port = Number(process.env.PORT || "5173");
const basePath = process.env.BASE_PATH || "/";
const apiPort = process.env.API_PORT || "3001";

// import.meta.dirname is available in Node 20+ (ESM)
const dir = import.meta.dirname;

export default defineConfig({
  base: basePath,
  plugins: [react()],
  css: {
    postcss: "./postcss.config.js",
  },
  resolve: {
    alias: {
      "@workspace/api-client-react": path.resolve(
        dir,
        "src/lib/workspace/api-client/index.ts",
      ),
      "@": path.resolve(dir, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: dir,
  build: {
    outDir: path.resolve(dir, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Code splitting for better caching
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": ["@xyflow/react", "framer-motion", "lucide-react"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
