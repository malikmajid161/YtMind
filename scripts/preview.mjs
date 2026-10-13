import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
export function previewServer(port = 4173) {
  const root = path.resolve("dist");
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".wasm": "application/wasm",
    ".gz": "application/gzip",
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost"),
        p = path.resolve(
          root,
          "." +
            decodeURIComponent(
              url.pathname === "/" ? "/panel.html" : url.pathname,
            ),
        );
      if (!p.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        types[path.extname(p)] || "application/octet-stream",
      );
      res.setHeader(
        "Content-Security-Policy",
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self' blob:; connect-src 'self' https://api.groq.com",
      );
      res.end(await readFile(p));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve(server)),
  );
}
if (process.argv[1]?.endsWith("preview.mjs")) {
  await previewServer();
  console.log("Design preview (sample data): http://127.0.0.1:4173/panel.html");
}
