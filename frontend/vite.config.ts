/// <reference types="vitest" />
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const NL = String.fromCharCode(10);

/** Writes robots.txt and sitemap.xml with absolute URLs for the configured public site. */
function seoFiles(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/+$/, "");
  const pages = ["/", "/help", "/login", "/register", "/privacy", "/terms"];
  let outDir = resolve(__dirname, "dist");
  return {
    name: "grievance-seo-files",
    apply: "build",
    configResolved(cfg) {
      outDir = resolve(cfg.root, cfg.build.outDir);
    },
    closeBundle() {
      const out = outDir;
      const today = new Date().toISOString().slice(0, 10);
      const urls = pages.map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`);
      writeFileSync(
        resolve(out, "sitemap.xml"),
        ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, "</urlset>", ""].join(NL),
      );
      writeFileSync(
        resolve(out, "robots.txt"),
        [
          "# Only public pages are indexable. Signed-in areas and shared traces are excluded.",
          "User-agent: *",
          ...pages.map((p) => `Allow: ${p === "/" ? "/$" : p}`),
          "Disallow: /citizen",
          "Disallow: /officer",
          "Disallow: /admin",
          "Disallow: /notifications",
          "Disallow: /share/",
          "",
          `Sitemap: ${site}/sitemap.xml`,
          "",
        ].join(NL),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  return {
    plugins: [react(), seoFiles(env.VITE_SITE_URL || "http://localhost:8080")],
    server: { port: 5173, strictPort: true },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
            charts: ["recharts"],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      // The intake flow test simulates real typing; 5 s (the default) is too tight on slower machines.
      testTimeout: 15000,
    },
  };
});
