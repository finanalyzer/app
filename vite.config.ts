import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import fs from "node:fs";
import path from "node:path";

function existsSync(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  function getApiHostnames(): string[] {
    const hosts: string[] = [];
    const apiUrl = env.VITE_API_BASE_URL;
    if (apiUrl) {
      try {
        const url = new URL(apiUrl);
        hosts.push(url.hostname);
      } catch { /* ignore invalid URL */ }
    }
    if (env.VITE_APP_HOST) {
      hosts.push(...env.VITE_APP_HOST.split(",").map(h => h.trim()).filter(Boolean));
    }
    return hosts;
  }

  const staticCopyTargets: { src: string; dest: string }[] = [];

  if (existsSync("node_modules/@openbb/ui/dist/assets")) {
    staticCopyTargets.push({
      src: "node_modules/@openbb/ui/dist/assets/*",
      dest: "",
    });
  }

  if (existsSync("../docs")) {
    staticCopyTargets.push({
      src: "../docs/*",
      dest: "docs",
    });
  }

  return {
    base: env.VITE_APP_BASE || "/",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: false,
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    ...(staticCopyTargets.length > 0
      ? [
          viteStaticCopy({
            targets: staticCopyTargets,
          }),
        ]
      : []),
  ],
  server: {
    port: 5174,
    open: false,
    allowedHosts: getApiHostnames(),
    proxy: {
      "/api": {
        target: "http://localhost:5182",
        changeOrigin: true,
        secure: false,
      },
      "/v1": {
        target: "http://localhost:8001",
        changeOrigin: true,
        secure: false,
      },
      "/v1/agent": {
        target: "http://localhost:7778",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://localhost:8001",
        ws: true,
        changeOrigin: true,
      },
      ...(env.VITE_PROXY_PATH ? {
        [env.VITE_PROXY_PATH]: {
          target: env.VITE_PROXY_TARGET_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(new RegExp(`^${env.VITE_PROXY_PATH}`), ""),
        },
      } : {}),
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@shared": "/../shared",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)/,
              priority: 30,
            },
            {
              name: "router",
              test: /node_modules[\\/](@tanstack|react-router)/,
              priority: 25,
            },
            {
              name: "charts",
              test: /node_modules[\\/](recharts|chart|d3|victory|nivo)/,
              priority: 20,
              minSize: 10000,
            },
            {
              name: "ui-vendor",
              test: /node_modules[\\/](antd|@openbb|lucide|@radix-ui)/,
              priority: 15,
            },
            {
              name: "i18n",
              test: /node_modules[\\/](i18next|react-i18next)/,
              priority: 12,
            },
            {
              name: "vendor",
              test: /node_modules/,
              priority: 10,
              minSize: 20000,
              maxSize: 250000,
            },
            {
              name: "common",
              minShareCount: 2,
              minSize: 10000,
              priority: 5,
            },
          ],
        },
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules")) {
            if (
              id.includes("react") &&
              !id.includes("react-router") &&
              !id.includes("react-query")
            ) {
              return "vendor";
            }
            if (id.includes("react-router")) return "router";
            if (id.includes("recharts") || id.includes("chart"))
              return "charts";
            if (id.includes("i18n")) return "i18n";
            return "vendor";
          }
        },
      },
    },
  },
  };
});
