import { defineConfig, type Plugin, type ResolvedConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { staticRoutes, type StaticRoute } from "./src/seo/static-routes";

const siteUrl = process.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://relaynew.ai";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildFallbackContent(route: StaticRoute) {
  return `
      <main style="max-width: 72rem; margin: 3rem auto; padding: 0 1.25rem; font-family: Arial, sans-serif;">
        <p style="letter-spacing: 0.18em; text-transform: uppercase; color: #6d5b28;">${escapeHtml(route.eyebrow)}</p>
        <h1 style="font-size: clamp(2.2rem, 7vw, 4.3rem); line-height: 0.98; letter-spacing: -0.05em; margin: 0;">
          ${escapeHtml(route.heading)}
        </h1>
        <p style="max-width: 44rem; margin-top: 1rem; line-height: 1.8; color: rgba(31,31,31,0.72);">
          ${escapeHtml(route.body)}
        </p>
        <p style="margin-top: 1.5rem;">
          <a href="/leaderboard" style="color: #1f1f1f;">查看站点目录</a>
          <span aria-hidden="true"> · </span>
          <a href="/probe" style="color: #1f1f1f;">开始站点测试</a>
        </p>
      </main>`;
}

function renderRouteHtml(indexHtml: string, route: StaticRoute) {
  const canonical = `${siteUrl}${route.path === "/" ? "/" : route.path}`;
  const fallbackContent = buildFallbackContent(route);

  return indexHtml
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(route.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s, `<meta name="description" content="${escapeHtml(route.description)}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/s, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/s, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/s, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/s, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/s, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/s, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<div id="root">[\s\S]*?<\/div>\s*<script/s, `<div id="root">${fallbackContent}\n    </div>\n    <script`);
}

function buildSitemap() {
  const urls = staticRoutes
    .map((route) => `  <url>\n    <loc>${siteUrl}${route.path === "/" ? "/" : route.path}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function routeFallbackPlugin(): Plugin {
  const routeByPath = new Map(staticRoutes.map((route) => [route.path, route]));
  let root = "";
  let outDir = "";

  return {
    name: "relaynew-static-route-fallbacks",
    configResolved(config: ResolvedConfig) {
      root = config.root;
      outDir = isAbsolute(config.build.outDir) ? config.build.outDir : join(root, config.build.outDir);
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }

        const pathname = new URL(req.url ?? "/", "http://localhost").pathname.replace(/\/$/, "") || "/";
        const route = routeByPath.get(pathname);

        const accept = req.headers.accept ?? "";

        if (!route || (accept && !accept.includes("text/html") && !accept.includes("*/*"))) {
          next();
          return;
        }

        const template = readFileSync(join(root, "index.html"), "utf8");
        const html = await server.transformIndexHtml(pathname, renderRouteHtml(template, route));
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(req.method === "HEAD" ? undefined : html);
      });
    },
    closeBundle() {
      const indexPath = join(outDir, "index.html");

      if (!existsSync(indexPath)) {
        return;
      }

      const indexHtml = readFileSync(indexPath, "utf8");
      writeFileSync(join(outDir, "sitemap.xml"), buildSitemap());

      for (const route of staticRoutes) {
        if (route.path === "/") {
          writeFileSync(indexPath, renderRouteHtml(indexHtml, route));
          continue;
        }

        const routeIndexPath = join(outDir, route.path.slice(1), "index.html");
        mkdirSync(dirname(routeIndexPath), { recursive: true });
        writeFileSync(routeIndexPath, renderRouteHtml(indexHtml, route));
      }
    },
  };
}

export default defineConfig({
  envDir: "../../",
  plugins: [react(), tailwindcss(), routeFallbackPlugin()],
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
