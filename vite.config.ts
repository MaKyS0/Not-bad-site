import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allPages, notFoundPage, renderBody, renderHead, THEME_INIT_SCRIPT, type PageSpec } from './src/seo/shell.ts';
import { APP_NAME, APP_SHORT_NAME, SUBTITLE } from './src/config.ts';
import { popularTools } from './src/tools/catalog.ts';

/**
 * BASE_PATH: set to "/<repository>/" for GitHub project pages (the deploy
 * workflow does this automatically). Without it the build uses a relative base
 * ("./") and works from any folder.
 * SITE_URL: absolute public URL ending with "/" — enables canonical URLs,
 * Open Graph URLs and sitemap.xml.
 */
const BASE_PATH = normalizeBase(process.env.BASE_PATH);
const SITE_URL = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/?$/, '/') : undefined;
const root = dirname(fileURLToPath(import.meta.url));

function normalizeBase(b?: string): string {
  if (!b || b === '.' || b === './') return './';
  let out = b.startsWith('/') ? b : `/${b}`;
  if (!out.endsWith('/')) out += '/';
  return out;
}

const sha256b64 = (s: string): string => createHash('sha256').update(s).digest('base64');

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' 'sha256-${sha256b64(THEME_INIT_SCRIPT)}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  // No third-party connections at all: user files physically cannot be sent anywhere.
  "connect-src 'self' blob: data:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function staticPagesPlugin(): Plugin {
  let config: ResolvedConfig;
  const fill = (template: string, page: PageSpec, base: string, csp?: string): string =>
    template
      .replace(/<html lang="[^"]*">/, `<html lang="${page.lang}">`)
      .replace('<!--app-head-->', renderHead(page, { base, siteUrl: SITE_URL, csp }))
      .replace('<!--app-body-->', renderBody(page, { base, siteUrl: SITE_URL }));

  return {
    name: 'uft-static-pages',
    configResolved(c) {
      config = c;
    },
    configureServer(server) {
      // Dev: serve pdf.js runtime assets (copied into dist/pdfjs/ at build time).
      server.middlewares.use((req, res, next) => {
        const m = /\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/([^?#]+)/.exec(req.url ?? '');
        if (!m || m[2].includes('..')) return next();
        const file = join(root, 'node_modules/pdfjs-dist', m[1], decodeURIComponent(m[2]));
        if (!existsSync(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // Dev server: render the home shell. Build: keep placeholders for closeBundle.
        if (!ctx.server) return html;
        // Pick the shell of the requested route (language + page) when it exists.
        const url = (ctx.originalUrl ?? '/').split('?')[0].replace(config.base, '');
        const route = url.replace(/index\.html$/, '');
        const pages = allPages(SITE_URL).map((f) => f(config.base));
        const home = pages.find((p) => p.path === route) ?? pages.find((p) => p.path === (route.startsWith('ru/') ? 'ru/' : '')) ?? pages[0];
        return fill(html, home, config.base);
      },
    },
    closeBundle() {
      if (config.command !== 'build') return;
      const out = config.build.outDir.startsWith('/') ? config.build.outDir : join(root, config.build.outDir);
      const templatePath = join(out, 'index.html');
      if (!existsSync(templatePath)) return;
      const template = readFileSync(templatePath, 'utf8');
      const relativeMode = BASE_PATH === './';

      const write = (page: PageSpec) => {
        const isFile = page.path.endsWith('.html');
        const depth = isFile ? 0 : page.path.split('/').filter(Boolean).length;
        const prefix = relativeMode ? (depth ? '../'.repeat(depth) : './') : BASE_PATH;
        let html = fill(template, page, prefix, CSP);
        if (relativeMode && depth) html = html.replace(/(src|href)="\.\/(assets\/)/g, `$1="${prefix}$2`);
        const file = isFile ? join(out, page.path) : join(out, page.path, 'index.html');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      };

      const pages = allPages(SITE_URL);
      for (const p of pages) {
        const probe = p('./');
        const depth = probe.path.split('/').filter(Boolean).length;
        const prefix = relativeMode ? (depth ? '../'.repeat(depth) : './') : BASE_PATH;
        write(p(prefix));
      }

      // 404.html is served by GitHub Pages for unknown URLs at any depth, so it
      // needs absolute URLs. In relative mode we guess the base at runtime.
      if (relativeMode) {
        writeFileSync(join(out, '404.html'), standalone404());
      } else {
        write({ ...notFoundPage(), body: notFoundPage().body.replace('</section>', `<p><a class="btn btn-primary" href="${BASE_PATH}">Go to home page</a></p></section>`) });
      }

      // PDF.js runtime assets (fonts, CMaps, WASM image decoders) — loaded on demand.
      const pdfjs = join(root, 'node_modules/pdfjs-dist');
      for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
        if (existsSync(join(pdfjs, dir))) cpSync(join(pdfjs, dir), join(out, 'pdfjs', dir), { recursive: true });
      }

      writeManifest(out);
      writeSeoFiles(out, pages.map((p) => p('./').path));
      writeServiceWorker(out);
      // Tell GitHub Pages not to run Jekyll (keeps files/folders starting with "_").
      writeFileSync(join(out, '.nojekyll'), '');
    },
  };
}

function standalone404(): string {
  // Relative-base builds don't know their URL prefix. Probe each parent path for
  // the app's manifest to find the site root, then fix the links.
  const script = "(async function(){var p=location.pathname.split('/').filter(Boolean);for(var k=p.length;k>=0;k--){var b='/'+p.slice(0,k).join('/')+(k?'/':'');try{var r=await fetch(b+'manifest.webmanifest',{method:'HEAD',cache:'no-store'});if(r.ok){var a=document.getElementById('home');a.href=b;a.nextElementSibling.href=b+'tools/';return;}}catch(e){}}})();";
  const csp = `default-src 'self'; script-src 'sha256-${sha256b64(script)}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="robots" content="noindex">
<title>Page not found | ${APP_NAME}</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:Canvas;color:CanvasText;padding:16px}
main{max-width:32rem;text-align:center}
h1{font-size:2rem;margin:0 0 .5rem}
p{opacity:.75;line-height:1.6}
a{display:inline-flex;align-items:center;min-height:44px;padding:0 1.25rem;margin:.25rem;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600}
a+a{background:transparent;color:inherit;border:1px solid currentColor}
</style>
</head>
<body>
<main>
<h1>Page not found</h1>
<p>The page you are looking for does not exist or was moved.</p>
<p><a id="home" href="/">Go to home page</a><a href="/tools/">All tools</a></p>
</main>
<script>${script}</script>
</body>
</html>
`;
}

function writeManifest(out: string): void {
  const manifest = {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: SUBTITLE,
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    background_color: '#0b0f17',
    theme_color: '#4f46e5',
    lang: 'en',
    dir: 'ltr',
    categories: ['utilities', 'productivity', 'developer'],
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: popularTools()
      .slice(0, 4)
      .map((t) => ({ name: t.name, short_name: t.name, description: t.description, url: `tools/${t.id}/`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] })),
  };
  writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
}

function writeSeoFiles(out: string, paths: string[]): void {
  const lines = ['User-agent: *', 'Allow: /'];
  if (SITE_URL) {
    const today = new Date().toISOString().slice(0, 10);
    const urls = paths
      .map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod><priority>${p === '' || p === 'ru/' ? '1.0' : /^(ru\/)?tools\//.test(p) ? '0.8' : '0.6'}</priority></url>`)
      .join('\n');
    writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    lines.push(`Sitemap: ${SITE_URL}sitemap.xml`);
  }
  writeFileSync(join(out, 'robots.txt'), `${lines.join('\n')}\n`);
}

function writeServiceWorker(out: string): void {
  const files = walk(out)
    .map((f) => relative(out, f).split('\\').join('/'))
    .filter((f) => !f.endsWith('.map') && f !== 'sw.js' && !f.startsWith('pdfjs/') && f !== '.nojekyll' && f !== '404.html' && f !== 'sitemap.xml' && f !== 'robots.txt' && !f.startsWith('icons/og-'))
    .map((f) => (f.endsWith('index.html') ? f.slice(0, -'index.html'.length) || './' : f))
    .sort();
  const hash = createHash('sha256');
  for (const f of walk(out).filter((p) => !p.endsWith('sw.js')).sort()) hash.update(readFileSync(f));
  const version = hash.digest('hex').slice(0, 12);
  const template = readFileSync(join(root, 'src/workers/sw.template.js'), 'utf8');
  writeFileSync(join(out, 'sw.js'), template.replace("'__VERSION__'", JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(files)));
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [staticPagesPlugin()],
  build: {
    target: ['es2020', 'safari14', 'firefox90', 'chrome88'],
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@jsquash/webp'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
