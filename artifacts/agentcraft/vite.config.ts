import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const port = Number(process.env.PORT || "5173");
const basePath = process.env.BASE_PATH || "/";
const apiPort = process.env.API_PORT || "3001";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  css: {
    // Tailwind v4 via PostCSS — no native bindings required
    postcss: "./postcss.config.js",
  },
  resolve: {
    alias: {
      "@workspace/api-client-react": path.resolve(
        __dirname,
        "src/lib/workspace/api-client/index.ts",
      ),
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
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
