/**
 * Static server that mimics GitHub Pages: serves ./dist under a sub-path
 * (default /Not-bad-site/), redirects directories to a trailing slash and
 * returns 404.html for missing files.
 *
 *   node scripts/serve.mjs [port] [basePath]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.argv[2] ?? 4173);
const base = process.argv[3] ?? '/Not-bad-site/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.bcmap': 'application/octet-stream',
};

export function startServer(p = port, b = base) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${p}`);
    let path = decodeURIComponent(url.pathname);
    if (!path.startsWith(b)) {
      if (path === b.slice(0, -1)) {
        res.writeHead(301, { Location: b });
        return res.end();
      }
      res.writeHead(404);
      return res.end('Not found');
    }
    let file = normalize(join(root, path.slice(b.length)));
    if (!file.startsWith(root.replace(/\/$/, ''))) {
      res.writeHead(403);
      return res.end();
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { Location: `${path}/${url.search}` });
        return res.end();
      }
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return createReadStream(join(root, '404.html')).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(p, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startServer();
  console.log(`Serving dist at http://localhost:${port}${base}`);
}
