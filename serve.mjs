#!/usr/bin/env node
// Zero-dependency static file server for Cruise Control.
// Serves the project root so /tools/hotspot-editor.html resolves ../assets correctly.
//
//   node serve.mjs                 → http://localhost:8000
//   node serve.mjs --port=5173     → custom port
//   node serve.mjs --open=/index.html
//   node serve.mjs --open=/tools/hotspot-editor.html
//
// Falls Node fehlt: alternativ `python3 -m http.server 8000` aus diesem Ordner.

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

const PORT = Number(args.port ?? process.env.PORT ?? 8000);
const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const full = resolve(join(root, decoded));
  if (!full.startsWith(root + sep) && full !== root) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = req.url || "/";
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = safeJoin(ROOT, urlPath);
    if (!filePath) { res.writeHead(403); return res.end("Forbidden"); }

    let st;
    try { st = await stat(filePath); }
    catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            return res.end(`404 — ${urlPath}\n\nNot found under ${ROOT}`); }

    const target = st.isDirectory() ? join(filePath, "index.html") : filePath;
    const data = await readFile(target);
    const type = TYPES[extname(target).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 — " + err.message);
  }
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`\n  Cruise Control dev server`);
  console.log(`  ─────────────────────────`);
  console.log(`  Wurzel:        ${ROOT}`);
  console.log(`  Spiel:         ${base}/index.html`);
  console.log(`  Hotspot-Editor:${base}/tools/hotspot-editor.html`);
  console.log(`\n  Strg-C zum Beenden.\n`);
  if (typeof args.open === "string") {
    const url = base + args.open;
    const cmd = process.platform === "darwin" ? "open"
              : process.platform === "win32"  ? "start"
              : "xdg-open";
    import("node:child_process").then(({ spawn }) =>
      spawn(cmd, [url], { stdio: "ignore", detached: true }).unref(),
    ).catch(() => {});
  }
});
