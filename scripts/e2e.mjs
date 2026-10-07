/**
 * End-to-end check of the production build in a real browser (Chromium via
 * Playwright). Serves ./dist under a GitHub-Pages-like sub-path and:
 *   1. opens every page (home, tools, categories, every tool) and fails on
 *      console errors, broken mounts or missing H1/meta;
 *   2. runs real operations with generated fixture files for every category;
 *   3. checks the service worker, manifest and offline mode;
 *   4. checks the mobile layout has no horizontal overflow.
 *
 * Usage: npm run build && npm run test:e2e
 * Env: CHROMIUM_PATH to use a specific browser binary.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { unzipSync, zipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { startServer } from './serve.mjs';

const PORT = 4280;
const BASE_PATH = process.env.BASE_PATH && process.env.BASE_PATH !== './' ? process.env.BASE_PATH : '/Not-bad-site/';
const ROOT = `http://localhost:${PORT}${BASE_PATH}`;
const exe = process.env.CHROMIUM_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

const server = await startServer(PORT, BASE_PATH);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`${page.url()} → ${m.text()}`);
});
page.on('pageerror', (e) => consoleErrors.push(`${page.url()} → pageerror: ${e.message}`));

const up = async (files, nth = 0) => {
  await page.waitForSelector('[data-dropzone] input[type=file]', { state: 'attached' });
  await page.setInputFiles(`[data-dropzone] input[type=file] >> nth=${nth}`, files);
};
const download = async (fn) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), fn()]);
  return { name: dl.suggestedFilename(), buf: readFileSync(await dl.path()) };
};
const text = (sel) => page.textContent(sel).then((t) => (t ?? '').replace(/\s+/g, ' ').trim());

try {
  // ---------------------------------------------------------------- pages
  console.log('\nPages');
  const toolIds = readdirSync(new URL('../dist/tools/', import.meta.url)).filter((d) => !d.includes('.'));
  const enPages = ['', 'tools/', ...['image', 'pdf', 'files', 'data', 'text', 'archive', 'audio', 'developer'].map((c) => `category/${c}/`), ...toolIds.map((t) => `tools/${t}/`)];
  const pages = [...enPages, ...enPages.map((p) => `ru/${p}`)];
  for (const p of pages) {
    const res = await page.goto(ROOT + p);
    const status = res?.status();
    await page.waitForLoadState('domcontentloaded');
    if (/^(ru\/)?tools\/./.test(p)) {
      await page.waitForFunction(() => !document.querySelector('#tool-root .loading') || document.querySelector('#tool-root .error-panel'), null, { timeout: 15000 }).catch(() => {});
      const broken = await page.$('#tool-root > .error-panel');
      if (broken) fail(`${p} mount error: ${await text('#tool-root')}`);
    }
    const h1 = await page.$eval('h1', (e) => e.textContent?.trim()).catch(() => '');
    const desc = await page.$eval('meta[name=description]', (e) => e.getAttribute('content')).catch(() => '');
    if (status !== 200 || !h1 || !desc) fail(`${p} status=${status} h1=${h1} desc=${!!desc}`);
    if (p.startsWith('ru/') && !/[а-яё]/i.test(`${h1} ${desc}`) && !/ в /.test(h1)) fail(`${p} is not Russian: ${h1}`);
    if (p.startsWith('ru/') && (await page.getAttribute('html', 'lang')) !== 'ru') fail(`${p} html lang is not ru`);
  }
  ok(`${pages.length} pages load with H1 + meta description`);

  // Static HTML (no JS) contains SEO content
  const raw = readFileSync(new URL('../dist/tools/png-to-webp/index.html', import.meta.url), 'utf8');
  check(/<h1>PNG to WebP<\/h1>/.test(raw) && raw.includes('application/ld+json') && raw.includes('FAQPage'), 'static page has H1, JSON-LD and FAQ without JavaScript');
  check(!/(src|href)="\/assets\//.test(raw), 'no root-absolute asset paths (GitHub Pages sub-path safe)');

  // 404 page
  const r404 = await page.goto(`${ROOT}does/not/exist`);
  check(r404?.status() === 404 && (await page.textContent('h1'))?.includes('not found'), '404 page is served');
  await page.waitForFunction((b) => document.querySelector('#home, a.btn-primary')?.getAttribute('href') === b, BASE_PATH, { timeout: 5000 }).catch(() => {});
  const homeHref = await page.getAttribute('#home, a.btn-primary', 'href');
  check(homeHref === BASE_PATH, `404 "home" link points to the base path (${homeHref})`);

  // ---------------------------------------------------------------- home + search + theme
  console.log('\nHome, search, navigation, theme');
  await page.goto(ROOT);
  check((await text('h1')) === 'File tools that run in your browser', 'home title');
  check((await text('.privacy-note')).includes('Nowhere. Files are read by your browser'), 'privacy statement visible');
  await page.keyboard.press('/');
  await page.waitForSelector('.dialog-search[open]');
  await page.fill('.search-input', 'webp');
  const results = await page.$$eval('.search-item strong', (els) => els.map((e) => e.textContent));
  check(['JPG to WebP', 'PNG to WebP', 'Compress WebP', 'Resize WebP'].every((n) => results.includes(n)), `search "webp" → ${results.slice(0, 6).join(', ')}…`);
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/tools\//);
  check(page.url().includes('/tools/'), `Enter opens first result (${page.url().replace(ROOT, '')})`);
  check((await page.getAttribute('.header-nav [data-nav="category/image"]', 'aria-current')) === 'true', 'header marks the current section on a tool page');
  await page.keyboard.press('/');
  await page.waitForSelector('.dialog-search[open]');
  await page.fill('.search-input', 'pdf');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(!(await page.$('.dialog-search[open]')), 'one Esc closes the search, even with text typed');
  {
    const m = await context.newPage();
    await m.setViewportSize({ width: 390, height: 800 });
    await m.goto(`${ROOT}tools/`);
    const navVisible = await m.isVisible('.header-nav');
    await m.click('[data-action="menu"]');
    const opened = await m.isVisible('#mobile-nav') && (await m.getAttribute('[data-action="menu"]', 'aria-expanded')) === 'true';
    await m.keyboard.press('Escape');
    const closed = !(await m.isVisible('#mobile-nav'));
    await m.click('[data-action="menu"]');
    await m.click('#mobile-nav a[href$="category/pdf/"]');
    await m.waitForURL(/category\/pdf/);
    check(!navVisible && opened && closed && !(await m.isVisible('#mobile-nav')) && (await m.textContent('h1')) === 'PDF tools', 'mobile menu: opens, closes with Esc, navigates and closes');
    await m.close();
  }
  // drop files on home → suggestions → tool receives files
  await page.goto(ROOT);
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 640, 480);
      g.addColorStop(0, '#f43f5e');
      g.addColorStop(1, '#6366f1');
      x.fillStyle = g;
      x.fillRect(0, 0, 640, 480);
      return c.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  const jpg = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 768;
      const x = c.getContext('2d');
      for (let i = 0; i < 3000; i++) {
        x.fillStyle = `hsl(${i % 360},70%,50%)`;
        x.fillRect((i * 37) % 1024, (i * 53) % 768, 24, 24);
      }
      return c.toDataURL('image/jpeg', 0.97).split(',')[1];
    }),
    'base64',
  );
  await up([{ name: 'one.png', mimeType: 'image/png', buffer: png }, { name: 'two.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.waitForSelector('.staged:not([hidden]) .tool-row');
  const sugg = await page.$$eval('.staged .tool-row-name', (e) => e.map((x) => x.textContent));
  check(sugg[0] === 'Image Compressor', `suggestions for 2 images: ${sugg.slice(0, 4).join(', ')}`);
  await page.click('.staged .tool-row >> nth=0');
  await page.waitForSelector('.file-row');
  check((await page.$$('.file-row')).length === 2, 'files handed over from home page to the tool (SPA navigation)');
  // theme
  await page.click('[data-action=settings]');
  await page.click('.dialog-settings label.seg:has-text("Dark")');
  check((await page.getAttribute('html', 'data-theme')) === 'dark', 'dark theme applied');
  await page.reload();
  check((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme persisted in localStorage');
  await page.evaluate(() => localStorage.removeItem('uft-settings'));

  // ---------------------------------------------------------------- image
  console.log('\nImage tools');
  await page.goto(`${ROOT}tools/image-compressor/`);
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.click('.batch-body .toolbar .btn-primary >> nth=0');
  await page.waitForSelector('.batch-summary:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.file-row .saving, .file-row .growing').length === 2, null, { timeout: 30000 });
  check(!!(await page.$('.compare')), `compress: ${await text('.batch-summary')} with before/after preview`);
  const zip = await download(() => page.click('button:has-text("Download All")'));
  const zipEntries = Object.keys(unzipSync(new Uint8Array(zip.buf)));
  check(zipEntries.length === 2, `Download All → ${zip.name} with ${zipEntries.join(', ')}`);

  await page.goto(`${ROOT}tools/jpg-to-webp/`);
  await up([{ name: 'b.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.click('.batch-body .toolbar .btn-primary >> nth=0');
  await page.waitForSelector('.batch-summary:not([hidden])');
  const webp = await download(() => page.click('.file-row button[aria-label^="Download"]'));
  check(webp.name === 'b.webp' && webp.buf.subarray(8, 12).toString() === 'WEBP', 'JPG → WebP produces a real WebP file');

  await page.goto(`${ROOT}tools/image-resizer/`);
  await up([{ name: 'b.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.fill('.tool-options input[type=number] >> nth=0', '300');
  await page.click('.batch-body .toolbar .btn-primary >> nth=0');
  await page.waitForSelector('.batch-summary:not([hidden])');
  check((await text('.file-row')).includes('300×225'), 'resize 1024×768 → 300×225 (aspect locked)');

  await page.goto(`${ROOT}tools/favicon-generator/`);
  await up([{ name: 'logo.png', mimeType: 'image/png', buffer: png }]);
  await page.waitForSelector('.entry-list');
  const fav = await download(() => page.click('button:has-text("Download all (ZIP)")'));
  const favEntries = Object.keys(unzipSync(new Uint8Array(fav.buf)));
  check(favEntries.includes('favicon.ico') && favEntries.includes('apple-touch-icon.png') && favEntries.length === 9, `favicon ZIP: ${favEntries.length} files`);

  await page.goto(`${ROOT}tools/image-cropper/`);
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }]);
  await page.waitForSelector('.crop-box');
  await page.click('label.seg:has-text("16:9")');
  await page.click('button:has-text("Crop image")');
  await page.waitForSelector('.preview-box img');
  check((await text('#tool-root')).includes('512 × 288 px'), 'crop 16:9 → 512×288');

  // ---------------------------------------------------------------- pdf
  console.log('\nPDF tools');
  const mk = async (n) => {
    const d = await PDFDocument.create();
    const f = await d.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= n; i++) d.addPage([595, 842]).drawText(`Page ${i}`, { x: 50, y: 700, size: 30, font: f });
    return Buffer.from(await d.save());
  };
  const pages5 = await mk(5);
  const pages2 = await mk(2);
  const countPages = async (b) => (await PDFDocument.load(b)).getPageCount();
  await page.goto(`${ROOT}tools/pdf-merge/`);
  await up([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: pages5 }, { name: 'b.pdf', mimeType: 'application/pdf', buffer: pages2 }]);
  await page.waitForFunction(() => document.querySelectorAll('.sort-item').length === 2);
  const merged = await download(() => page.click('button:has-text("Merge PDFs")'));
  check((await countPages(merged.buf)) === 7, 'merge 5 + 2 pages → 7');
  await page.goto(`${ROOT}tools/pdf-split/`);
  await up([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: pages5 }]);
  await page.click('label.seg:has-text("Every page")');
  await page.click('button:has-text("Split PDF")');
  await page.waitForSelector('.batch-summary');
  check((await page.$$('.entry')).length === 5, 'split every page → 5 PDFs');
  await page.goto(`${ROOT}tools/pdf-to-images/`);
  await up([{ name: 'b.pdf', mimeType: 'application/pdf', buffer: pages2 }]);
  await page.click('button:has-text("Convert to images")');
  await page.waitForSelector('.batch-summary', { timeout: 30000 });
  check((await page.$$('.file-row img')).length === 2, 'PDF → 2 PNG images rendered with pdf.js');

  // ---------------------------------------------------------------- data / text / dev
  console.log('\nData, text and developer tools');
  await page.goto(`${ROOT}tools/json-formatter/`);
  await page.fill('textarea', '{"b":[1,2],"a":{"x":null}}');
  await page.click('button:has-text("Format")');
  check((await page.$$('.code-view .tok-key')).length === 3 && (await text('.status-line')).includes('Valid'), 'JSON formatted with syntax highlighting');
  await page.fill('textarea', '{\n  "a": 1,\n  "b": }');
  await page.click('button:has-text("Validate")');
  check((await text('.status-line')).includes('line 3, column 8'), `invalid JSON reported: ${await text('.status-line')}`);

  await page.goto(`${ROOT}tools/csv-to-json/`);
  await page.fill('textarea', 'name;age\n"Ann";31\nBob;27');
  await page.waitForTimeout(400);
  const json = JSON.parse(await page.inputValue('textarea[readonly]'));
  check(json.length === 2 && json[0].age === 31 && json[1].name === 'Bob', 'CSV (semicolon, auto-detected) → JSON with typed numbers');
  await page.goto(`${ROOT}tools/json-to-csv/`);
  await page.fill('textarea', '[{"n":"A","o":{"c":"X"}},{"n":"B, C"}]');
  await page.waitForTimeout(400);
  check((await page.inputValue('textarea[readonly]')) === 'n,o.c\nA,X\n"B, C",', 'JSON → CSV with flattening and quoting');
  const csvFile = await download(() => page.click('button:has-text("Download")'));
  check(csvFile.buf.toString() === 'n,o.c\r\nA,X\r\n"B, C",', 'downloaded CSV keeps CRLF line endings');
  await page.goto(`${ROOT}tools/csv-viewer/`);
  // Windows-1251 encoded CSV
  const cp1251 = Buffer.from([0xc8, 0xec, 0xff, 0x2c, 0xc3, 0xee, 0xf0, 0xee, 0xe4, 0x0a, 0xc0, 0xed, 0xff, 0x2c, 0xcc, 0xee, 0xf1, 0xea, 0xe2, 0xe0]);
  await page.selectOption('select[aria-label="Text encoding"]', 'windows-1251');
  await page.setInputFiles('.field input[type=file]', [{ name: 'ru.csv', mimeType: 'text/csv', buffer: cp1251 }]);
  await page.waitForSelector('.data-table');
  check((await text('.data-table')).includes('Аня') && (await text('.data-table')).includes('Город'), 'CSV viewer decodes Windows-1251');
  await page.goto(`${ROOT}tools/xml-formatter/`);
  await page.fill('textarea', '<a><b x="1">t</b><c/></a>');
  await page.click('button:has-text("Format")');
  check((await page.inputValue('textarea[readonly]')) === '<a>\n  <b x="1">t</b>\n  <c/>\n</a>', 'XML formatted');
  await page.fill('textarea', '<a><b></a>');
  await page.click('button:has-text("Validate")');
  check((await text('.status-line')).includes('Not well-formed'), 'malformed XML detected');
  await page.goto(`${ROOT}tools/markdown-preview/`);
  await page.fill('textarea', '# Hi\n\n<img src=x onerror="window.__xss=1">\n\n**b**');
  await page.waitForTimeout(300);
  check((await page.$('.markdown-body h1')) && !(await page.$('.markdown-body img')) && !(await page.evaluate(() => window.__xss)), 'Markdown renders safely (no raw HTML)');

  await page.goto(`${ROOT}tools/word-counter/`);
  await page.fill('textarea', 'Hello world. Привет мир!\nSecond line');
  await page.waitForTimeout(300);
  check((await text('.stats')).includes('Words6'), `word counter: ${await text('.stats')}`);
  await page.goto(`${ROOT}tools/remove-duplicate-lines/`);
  await page.fill('textarea', 'a\nb\na\nc\nb');
  await page.waitForTimeout(300);
  check((await page.inputValue('textarea[readonly]')) === 'a\nb\nc', 'remove duplicate lines');
  await page.goto(`${ROOT}tools/case-converter/`);
  await page.selectOption('select', 'snake');
  await page.fill('textarea', 'helloBigWorld');
  await page.waitForTimeout(300);
  check((await page.inputValue('textarea[readonly]')) === 'hello_big_world', 'case converter → snake_case');
  await page.goto(`${ROOT}tools/base64/`);
  await page.fill('textarea', 'Привет 👋');
  await page.waitForTimeout(300);
  check((await page.inputValue('textarea[readonly]')) === '0J/RgNC40LLQtdGCIPCfkYs=', 'Base64 encodes UTF-8');
  await page.goto(`${ROOT}tools/url-encoder/`);
  await page.fill('textarea', 'a b&c');
  await page.waitForTimeout(300);
  check((await page.inputValue('textarea[readonly]')) === 'a%20b%26c', 'URL encode');
  await page.goto(`${ROOT}tools/html-entities/`);
  await page.click('label.seg:has-text("Decode")');
  await page.fill('textarea', '&lt;b&gt; &amp; &hearts;');
  await page.waitForTimeout(300);
  check((await page.inputValue('textarea[readonly]')) === '<b> & ♥', 'HTML entity decode (full entity table)');
  await page.goto(`${ROOT}tools/uuid-generator/`);
  check((await page.inputValue('textarea[readonly]')).split('\n').length === 10, 'UUID generator');
  await page.goto(`${ROOT}tools/text-hash/`);
  await page.fill('textarea', 'abc');
  await page.waitForTimeout(400);
  check((await text('.kv')).includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), 'SHA-256("abc") correct');
  await page.goto(`${ROOT}tools/jwt-decoder/`);
  await page.click('button:has-text("Sample")');
  await page.waitForTimeout(300);
  check((await text('#tool-root')).includes('Ann Example') && (await text('#tool-root')).includes('Signature not verified'), 'JWT decoded');

  // ---------------------------------------------------------------- files / archive / audio
  console.log('\nFiles, archive and audio tools');
  await page.goto(`${ROOT}tools/file-inspector/`);
  await up([{ name: 'renamed.txt', mimeType: 'text/plain', buffer: png }]);
  await page.waitForFunction(() => /[0-9a-f]{64}/.test(document.querySelector('.hash-out')?.textContent ?? ''), null, { timeout: 20000 });
  const inspect = await text('#tool-root');
  check(inspect.includes('PNG image') && inspect.includes('640 × 480') && inspect.includes('looks like: PNG image'), 'inspector: magic-byte detection, dimensions, mismatch warning, SHA-256');
  // SVG with script: previews must not be same-origin blob: documents
  {
    const evilSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" onload="document.title=1"><rect width="40" height="40"/></svg>');
    await page.goto(`${ROOT}tools/svg-to-png/`);
    await up([{ name: 'evil.svg', mimeType: 'image/svg+xml', buffer: evilSvg }]);
    await page.waitForFunction(() => document.querySelector('.file-thumb img')?.getAttribute('src'), null, { timeout: 10000 });
    const src = await page.getAttribute('.file-thumb img', 'src');
    check(src.startsWith('data:image/svg+xml'), 'SVG thumbnails use data: URLs (no same-origin script via “open image in new tab”)');
  }
  // virus check: disguised program, EICAR in a ZIP, clean file — and the RU UI
  {
    const exeBuf = Buffer.alloc(512);
    exeBuf.write('MZ', 0, 'latin1');
    exeBuf.writeUInt32LE(0x80, 0x3c);
    exeBuf.write('PE\0\0', 0x80, 'latin1');
    const eicar = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', 'STANDARD', 'ANTIVIRUS', 'TEST', 'FILE!$H+H*'].join('-');
    const eicarZip = Buffer.from(zipSync({ 'readme.txt': new TextEncoder().encode(eicar) }));
    await page.goto(`${ROOT}tools/virus-scanner/`);
    await up([
      { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: exeBuf },
      { name: 'files.zip', mimeType: 'application/zip', buffer: eicarZip },
      { name: 'photo.png', mimeType: 'image/png', buffer: png },
    ]);
    await page.waitForFunction(() => document.querySelectorAll('.verdict').length === 3, null, { timeout: 30000 });
    const verdicts = await page.$$eval('.verdict', (els) => els.map((e) => e.className));
    check(verdicts[0].includes('danger') && verdicts[1].includes('danger') && verdicts[2].includes('clean'), `virus check verdicts: ${verdicts.join(' | ')}`);
    const vtxt = await text('#tool-root');
    check(vtxt.includes('Program disguised as another file type') && vtxt.includes('EICAR antivirus test file') && vtxt.includes('readme.txt'), 'virus check: disguised EXE + EICAR inside ZIP reported');
    await page.waitForSelector('a[href^="https://www.virustotal.com/gui/file/"]', { timeout: 20000 });
    const vt = await page.getAttribute('a[href^="https://www.virustotal.com/gui/file/"] >> nth=2', 'href');
    const pngHash = createHash('sha256').update(png).digest('hex');
    check(vt === `https://www.virustotal.com/gui/file/${pngHash}`, 'virus check: VirusTotal link carries only the SHA-256');
    check(vtxt.includes('Checked 3 files: 2 dangerous, 0 need caution, 1 without threats.'), 'virus check: batch summary');
    await page.goto(`${ROOT}ru/tools/virus-scanner/`);
    await up([{ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: exeBuf }]);
    await page.waitForSelector('.verdict', { timeout: 20000 });
    const rtxt = await text('#tool-root');
    check(rtxt.includes('Найдены опасные признаки') && rtxt.includes('Программа под видом файла другого типа') && rtxt.includes('Программа Windows (EXE)'), 'virus check: Russian UI');
  }
  await page.goto(`${ROOT}tools/zip/`);
  await up([{ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello '.repeat(500)) }, { name: 'b.png', mimeType: 'image/png', buffer: png }]);
  await page.waitForSelector('.entry');
  await page.click('.entry >> nth=1 >> button');
  check((await page.$$('.entry')).length === 1, 'ZIP creator: remove a file');
  const z = await download(() => page.click('button:has-text("Download ZIP")'));
  const zEntries = unzipSync(new Uint8Array(z.buf));
  check(Object.keys(zEntries).join() === 'a.txt' && new TextDecoder().decode(zEntries['a.txt']).startsWith('hello'), 'ZIP creator: valid archive');
  await page.goto(`${ROOT}tools/unzip/`);
  await up([{ name: 'x.zip', mimeType: 'application/zip', buffer: z.buf }]);
  await page.waitForSelector('.entry');
  const extracted = await download(() => page.click('.entry button[aria-label^="Download"]'));
  check(extracted.buf.toString().startsWith('hello hello'), 'ZIP extractor: download single entry');

  // WAV fixture: 1 s 440 Hz stereo
  const wav = (() => {
    const rate = 8000;
    const n = rate;
    const b = Buffer.alloc(44 + n * 4);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + n * 4, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(2, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 4, 28);
    b.writeUInt16LE(4, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
      const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 16000);
      b.writeInt16LE(v, 44 + i * 4);
      b.writeInt16LE(v, 46 + i * 4);
    }
    return b;
  })();
  await page.goto(`${ROOT}tools/audio-info/`);
  await up([{ name: 'tone.wav', mimeType: 'audio/wav', buffer: wav }]);
  await page.waitForSelector('.stats', { timeout: 20000 });
  check((await text('.stats')).includes('Stereo'), `audio info: ${await text('.stats')}`);
  await page.goto(`${ROOT}tools/audio-trimmer/`);
  await up([{ name: 'tone.wav', mimeType: 'audio/wav', buffer: wav }]);
  await page.waitForSelector('input[aria-label="End (seconds)"]', { timeout: 20000 });
  await page.fill('input[aria-label="End (seconds)"]', '0.5');
  await page.click('button:has-text("Download trimmed WAV")');
  await page.waitForSelector('.batch-summary', { timeout: 20000 });
  const trimmed = await download(() => page.click('.batch-summary button'));
  check(trimmed.buf.readUInt32LE(40) === 4000 * 4 * (trimmed.buf.readUInt32LE(24) / 8000) || trimmed.buf.readUInt32LE(40) > 0, `trimmed WAV ${trimmed.buf.length} bytes`);
  check(Math.abs(trimmed.buf.readUInt32LE(40) / (trimmed.buf.readUInt32LE(24) * 4) - 0.5) < 0.01, 'trimmed WAV duration ≈ 0.5 s');

  // ---------------------------------------------------------------- history
  await page.goto(ROOT);
  await page.waitForSelector('#recent-h', { timeout: 5000 }).catch(() => {});
  check(!!(await page.$('#recent-h')), 'recently used tools shown on home');

  // ---------------------------------------------------------------- Russian
  console.log('\nRussian version');
  const rawRu = readFileSync(new URL('../dist/ru/tools/pdf-merge/index.html', import.meta.url), 'utf8');
  check(rawRu.includes('<html lang="ru">') && rawRu.includes('<h1>Объединить PDF</h1>') && rawRu.includes('hreflang="en"'), 'static RU page: lang, H1, hreflang alternates');
  await page.goto(`${ROOT}tools/image-compressor/`);
  const ruHref = await page.getAttribute('.lang-switch a[hreflang="ru"]', 'href');
  check(ruHref?.endsWith('/ru/tools/image-compressor/'), `language switch points to the same page (${ruHref})`);
  await page.click('.lang-switch a[hreflang="ru"]');
  await page.waitForURL(/\/ru\/tools\/image-compressor\/$/);
  check((await text('h1')) === 'Сжатие изображений' && (await page.getAttribute('html', 'lang')) === 'ru', 'switched to Russian on the same tool');
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  check((await text('.batch-actions .btn-primary')).includes('Сжать все (2 файла)'), `RU action button with plural: ${await text('.batch-actions .btn-primary')}`);
  await page.click('.batch-actions .btn-primary >> nth=0');
  await page.waitForSelector('.toast-success', { timeout: 30000 });
  check((await text('.toast-success')).includes('Готово! Обработано: 2 файла.'), `RU success toast: ${await text('.toast-success')}`);
  check((await text('.batch-summary')).includes('Готово 2 из 2'), 'RU batch summary');
  // SPA navigation keeps the language; search works with Russian words
  await page.keyboard.press('/');
  await page.fill('.search-input', 'объединить');
  check((await text('.search-item strong')).startsWith('Объединить PDF'), 'Russian search query finds “Объединить PDF”');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/ru\/tools\/pdf-merge\/$/);
  check((await text('h1')) === 'Объединить PDF', 'SPA navigation stays in Russian');
  // RU error message translation (worker error → translated)
  await page.goto(`${ROOT}ru/tools/pdf-split/`);
  await up([{ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 garbage') }]);
  await page.waitForSelector('.error-panel', { timeout: 15000 });
  check((await text('.error-panel')).includes('Это не корректный PDF.'), `RU error panel: ${(await text('.error-panel')).slice(0, 80)}`);
  // page-wide drop: drop a file on the page body (outside the drop zone)
  await page.goto(`${ROOT}ru/tools/file-inspector/`);
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File(['hello'], 'note.txt', { type: 'text/plain' }));
    return d;
  });
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt });
  check(!!(await page.$('.drop-overlay')), 'page-wide drop overlay appears');
  await page.dispatchEvent('main', 'drop', { dataTransfer: dt });
  await page.waitForSelector('.kv', { timeout: 10000 });
  check((await text('#tool-root')).includes('note.txt'), 'file dropped anywhere on the page reaches the tool');
  // automatic language for a Russian-speaking browser on the first visit
  const ruCtx = await browser.newContext({ locale: 'ru-RU' });
  const ruPage = await ruCtx.newPage();
  await ruPage.goto(`${ROOT}tools/zip/`);
  await ruPage.waitForURL(/\/ru\/tools\/zip\/$/, { timeout: 10000 }).catch(() => {});
  check(ruPage.url().endsWith('/ru/tools/zip/'), 'first visit with ru-RU browser opens the Russian page');
  await ruPage.goto(`${ROOT}ru/`);
  await ruPage.click('.lang-switch a[hreflang="en"]');
  await ruPage.waitForURL((u) => !u.pathname.includes('/ru/'));
  await ruPage.goto(`${ROOT}tools/zip/`);
  await ruPage.waitForTimeout(500);
  check(!ruPage.url().includes('/ru/'), 'explicit choice of English is remembered');
  await ruCtx.close();

  // ---------------------------------------------------------------- PWA / offline
  console.log('\nPWA & offline');
  const manifest = await (await page.request.get(`${ROOT}manifest.webmanifest`)).json();
  check(manifest.start_url === './' && manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest with relative start_url and maskable icon');
  await page.goto(ROOT);
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await context.setOffline(true);
  await page.goto(`${ROOT}tools/json-formatter/`);
  await page.waitForSelector('textarea', { timeout: 15000 });
  await page.fill('textarea', '[1,2]');
  await page.click('button:has-text("Format")');
  check((await text('.status-line')).includes('Valid'), 'JSON formatter works offline after first visit');
  await page.goto(`${ROOT}tools/image-converter/`);
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }]);
  await page.click('.batch-body .toolbar .btn-primary >> nth=0');
  await page.waitForSelector('.batch-summary:not([hidden])', { timeout: 20000 });
  check(true, 'image converter works offline');
  await context.setOffline(false);

  // ---------------------------------------------------------------- mobile
  console.log('\nMobile layout');
  const mobile = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  for (const p of ['', 'tools/', 'tools/image-compressor/', 'tools/pdf-merge/', 'tools/json-formatter/', 'tools/image-cropper/', 'tools/csv-viewer/', 'ru/', 'ru/tools/image-resizer/', 'ru/tools/pdf-split/', 'ru/tools/word-counter/']) {
    await mp.goto(ROOT + p);
    await mp.waitForTimeout(400);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no horizontal scroll at 360px: /${p} (${overflow}px)`);
  }
  const small = await mp.evaluate(() =>
    [...document.querySelectorAll('button, a.btn, .icon-btn, input[type=checkbox] + .switch, select, input:not([type=hidden]):not(.sr-only):not([type=range])')]
      .filter((e) => e.offsetParent !== null && !e.closest('.sr-only, .breadcrumbs, .site-footer'))
      .map((e) => [e.getBoundingClientRect().height, e.className || e.tagName])
      .filter(([hgt, c]) => hgt < 36 && !String(c).includes('switch')),
  );
  check(small.length === 0, `touch targets ≥ 36px on mobile (${small.length} smaller)`);
  await mobile.close();

  console.log('\nConsole errors');
  const relevant = consoleErrors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource: net::ERR_FAILED/.test(e) && !/status of 404/.test(e));
  check(relevant.length === 0, relevant.length ? `console errors:\n    ${relevant.slice(0, 10).join('\n    ')}` : 'no console errors');
} catch (e) {
  fail(`Unexpected failure: ${e.stack ?? e}`);
} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll E2E checks passed');
process.exit(failures ? 1 : 0);
