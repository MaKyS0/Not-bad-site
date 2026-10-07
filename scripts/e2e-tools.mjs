/**
 * Functional checks for the tools and presets that scripts/e2e.mjs does not
 * exercise: every image converter preset, compressor presets, WebP resizer,
 * rotator, metadata, the PDF page tools, hashes, data URIs, audio conversion
 * and the text presets. Same setup as e2e.mjs (production build, Chromium).
 *
 * Usage: npm run build && npm run test:e2e:tools
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { startServer } from './serve.mjs';

const PORT = 4281;
const BASE_PATH = process.env.BASE_PATH && process.env.BASE_PATH !== './' ? process.env.BASE_PATH : '/Not-bad-site/';
const ROOT = `http://localhost:${PORT}${BASE_PATH}`;
const exe = process.env.CHROMIUM_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
await startServer(PORT, BASE_PATH);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()} → ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} → ${m.text()}`));

let failures = 0;
const results = [];
const check = (cond, msg) => { results.push(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };
const up = async (files) => {
  await page.waitForSelector('[data-dropzone] input[type=file]', { state: 'attached' });
  await page.setInputFiles('[data-dropzone] input[type=file] >> nth=0', files);
};
const download = async (fn) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), fn()]);
  return { name: dl.suggestedFilename(), buf: readFileSync(await dl.path()) };
};
const text = (sel) => page.textContent(sel).then((t) => (t ?? '').replace(/\s+/g, ' ').trim());
const go = async (id) => {
  await page.goto(`${ROOT}tools/${id}/`);
  await page.waitForFunction(() => !document.querySelector('#tool-root .loading'), null, { timeout: 15000 }).catch(() => {});
};
const test = async (name, fn) => {
  try { await fn(); } catch (e) { check(false, `${name}: ${String(e.message).split('\n')[0]} | ${(await text('#tool-root').catch(() => '')).slice(0, 160)}`); }
};
const runBatch = async () => {
  await page.click('.batch-body .toolbar .btn-primary >> nth=0');
  await page.waitForSelector('.batch-summary:not([hidden])', { timeout: 30000 });
};
const dlFirst = () => download(() => page.click('.file-row button[aria-label^="Download"] >> nth=0'));
const magic = (b) => b.subarray(0, 4).toString('hex') === '89504e47' ? 'png' : b.subarray(0, 3).toString('hex') === 'ffd8ff' ? 'jpg' : b.subarray(8, 12).toString() === 'WEBP' ? 'webp' : '?';
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

// ---------- fixtures (made in the browser)
await page.goto(ROOT);
const enc = (type) => page.evaluate(async (type) => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d'); x.fillStyle = '#1a6b56'; x.fillRect(0, 0, 640, 480); x.fillStyle = '#c4501a'; x.fillRect(40, 40, 200, 120);
  const b = await new Promise((r) => c.toBlob(r, type, 0.92));
  return Array.from(new Uint8Array(await b.arrayBuffer()));
}, type).then((a) => Buffer.from(a));
const png = await enc('image/png'), jpg = await enc('image/jpeg'), webp = await enc('image/webp');
const bmp = (() => { const w = 4, h = 3, row = w * 3, b = Buffer.alloc(54 + row * h); b.write('BM'); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.fill(0x80, 54); return b; })();
const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const smallPng = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 32; c.getContext('2d').fillRect(0, 0, 16, 16); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); }).then((a) => Buffer.from(a));
const ico = (() => { const h = Buffer.alloc(22); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4); h[6] = 32; h[7] = 32; h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(smallPng.length, 14); h.writeUInt32LE(22, 18); return Buffer.concat([h, smallPng]); })();
const mkPdf = async (n) => { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); for (let i = 1; i <= n; i++) d.addPage([595, 842]).drawText(`Page ${i}`, { x: 50, y: 700, size: 30, font: f }); d.setTitle('Test doc'); return Buffer.from(await d.save()); };
const pdf5 = await mkPdf(5);
const wav = (() => { const rate = 8000, n = rate, b = Buffer.alloc(44 + n * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40); for (let i = 0; i < n; i++) { const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 16000); b.writeInt16LE(v, 44 + i * 4); b.writeInt16LE(v, 46 + i * 4); } return b; })();

// ---------- image converter variants
const conv = [
  ['png-to-jpg', 'a.png', 'image/png', png, 'jpg'], ['jpg-to-png', 'a.jpg', 'image/jpeg', jpg, 'png'],
  ['png-to-webp', 'a.png', 'image/png', png, 'webp'], ['webp-to-png', 'a.webp', 'image/webp', webp, 'png'],
  ['webp-to-jpg', 'a.webp', 'image/webp', webp, 'jpg'], ['bmp-to-png', 'a.bmp', 'image/bmp', bmp, 'png'],
  ['gif-to-png', 'a.gif', 'image/gif', gif, 'png'], ['ico-to-png', 'a.ico', 'image/x-icon', ico, 'png'],
  ['image-converter', 'a.jpg', 'image/jpeg', jpg, 'webp'],
];
for (const [id, name, mime, buf, want] of conv) await test(id, async () => {
  await go(id);
  if (id === 'image-converter') await page.selectOption('.tool-options select >> nth=0', 'webp');
  await up([{ name, mimeType: mime, buffer: buf }]);
  await runBatch();
  const out = await dlFirst();
  check(magic(out.buf) === want && out.name.endsWith(`.${want}`), `${id}: ${name} → ${out.name} (${magic(out.buf)}, ${out.buf.length} B)`);
});

// ---------- compressor variants, webp resizer, rotator, metadata
for (const [id, name, mime, buf] of [['compress-jpg', 'a.jpg', 'image/jpeg', jpg], ['compress-png', 'a.png', 'image/png', png], ['compress-webp', 'a.png', 'image/png', png]]) await test(id, async () => {
  await go(id);
  await up([{ name, mimeType: mime, buffer: buf }]);
  await runBatch();
  const out = await dlFirst();
  check(magic(out.buf) !== '?' && out.buf.length > 0, `${id}: ${await text('.batch-summary')} → ${out.name} (${magic(out.buf)})`);
});
await test('webp-resizer', async () => {
  await go('webp-resizer');
  await up([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.fill('.tool-options input[type=number] >> nth=0', '320');
  await runBatch();
  const out = await dlFirst();
  check(magic(out.buf) === 'webp' && (await text('.file-row')).includes('320×240'), `webp-resizer: 640×480 JPG → ${out.name} 320×240 (${magic(out.buf)})`);
});
await test('image-rotator', async () => {
  await go('image-rotator');
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }]);
  await page.click('label.seg:has-text("90°")');
  await runBatch();
  const out = await dlFirst();
  check(magic(out.buf) === 'png' && pngSize(out.buf).join('×') === '480×640', `image-rotator 90°: 640×480 → ${pngSize(out.buf).join('×')}`);
});
await test('image-metadata', async () => {
  await go('image-metadata');
  await up([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.waitForSelector('button:has-text("Copy all metadata as JSON")', { timeout: 20000 });
  const t = await text('.tool-main');
  check(/640\s*[×x]\s*480/.test(t), `image-metadata: ${t.slice(0, 120)}…`);
});

// ---------- PDF
const pages = async (b) => (await PDFDocument.load(b)).getPageCount();
await test('pdf-extract-pages', async () => {
  await go('pdf-extract-pages');
  await up([{ name: 'doc.pdf', mimeType: 'application/pdf', buffer: pdf5 }]);
  await page.waitForSelector('input[aria-label="Selected pages"]', { timeout: 20000 });
  await page.fill('input[aria-label="Selected pages"]', '2-3, 5');
  const out = await download(() => page.click('button:has-text("Extract pages")'));
  check((await pages(out.buf)) === 3, `pdf-extract-pages "2-3, 5" → ${out.name} with ${await pages(out.buf)} pages`);
});
await test('pdf-rotate', async () => {
  await go('pdf-rotate');
  await up([{ name: 'doc.pdf', mimeType: 'application/pdf', buffer: pdf5 }]);
  await page.waitForSelector('button:has-text("Select all")', { timeout: 20000 });
  await page.click('button:has-text("Select all")');
  await page.click('button:has-text("Rotate right 90°")');
  const out = await download(() => page.click('button:has-text("Save rotated PDF")'));
  const d = await PDFDocument.load(out.buf);
  const rots = d.getPages().map((p) => p.getRotation().angle);
  check(rots.length === 5 && rots.every((r) => r === 90), `pdf-rotate: all pages → ${rots.join(',')}°`);
});
await test('images-to-pdf', async () => {
  await go('images-to-pdf');
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
  await page.waitForSelector('button:has-text("Create PDF")', { timeout: 20000 });
  const out = await download(() => page.click('button:has-text("Create PDF")'));
  check((await pages(out.buf)) === 2, `images-to-pdf: 2 images → ${out.name} with ${await pages(out.buf)} pages`);
});
await test('pdf-info', async () => {
  await go('pdf-info');
  await up([{ name: 'doc.pdf', mimeType: 'application/pdf', buffer: pdf5 }]);
  await page.waitForSelector('button:has-text("Inspect another PDF")', { timeout: 20000 });
  const t = await text('#tool-root');
  check(/Pages\s*5/.test(t) && t.includes('Test doc'), `pdf-info: ${t.slice(0, 140)}…`);
});

// ---------- files, developer
await test('hash-generator', async () => {
  await go('hash-generator');
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: png }]);
  const want = createHash('sha256').update(png).digest('hex');
  await page.waitForFunction((w) => document.querySelector('#tool-root')?.textContent?.includes(w), want, { timeout: 20000 });
  check(true, 'hash-generator: SHA-256 matches Node crypto');
  await page.fill('input[aria-label="Expected hash"], .field input[type=text] >> nth=0', want.toUpperCase()).catch(() => {});
  await page.waitForTimeout(300);
  check(/match/i.test(await text('#tool-root')), `hash-generator: expected-hash comparison (${(await text('#tool-root')).match(/[^.]*match[^.]*/i)?.[0] ?? 'no message'})`);
});
await test('data-uri', async () => {
  await go('data-uri');
  await up([{ name: 'a.png', mimeType: 'image/png', buffer: smallPng }]);
  await page.waitForSelector('pre.code-view', { timeout: 20000 });
  const code = await page.textContent('pre.code-view >> nth=0');
  check(code.startsWith('data:image/png;base64,') && Buffer.from(code.split(',')[1], 'base64').equals(smallPng), `data-uri: ${code.slice(0, 40)}… decodes back to the file`);
});
await test('audio-converter', async () => {
  await go('audio-converter');
  await up([{ name: 'tone.wav', mimeType: 'audio/wav', buffer: wav }]);
  await page.waitForSelector('button:has-text("Convert to WAV")', { timeout: 20000 });
  await page.click('label.seg:has-text("Mono")');
  await page.selectOption('.panel select', '16000');
  await page.click('button:has-text("Convert to WAV")');
  await page.waitForSelector('.batch-summary', { timeout: 20000 });
  const out = await download(() => page.click('.batch-summary button'));
  const ch = out.buf.readUInt16LE(22), rate = out.buf.readUInt32LE(24), bits = out.buf.readUInt16LE(34);
  check(out.buf.toString('ascii', 0, 4) === 'RIFF' && ch === 1 && rate === 16000 && bits === 16, `audio-converter: stereo 8 kHz → ${ch} ch, ${rate} Hz, ${bits}-bit WAV`);
});

// ---------- text variants
const textTool = async (id, input, want, prep) => test(id, async () => {
  await go(id);
  if (prep) await prep();
  await page.fill('textarea >> nth=0', input);
  await page.waitForTimeout(400);
  const got = await page.inputValue('textarea[readonly]');
  check(got === want, `${id}: ${JSON.stringify(input)} → ${JSON.stringify(got)}`);
});
await textTool('sort-lines', 'pear\napple\nBanana\nёж\nель', 'apple\nBanana\npear\nёж\nель');
await textTool('reverse-text', 'abc\nxyz', 'zyx\ncba');
await textTool('trim-spaces', '  a   b  \n\tc  ', 'a b\nc');
for (const id of ['character-counter', 'line-counter']) await test(id, async () => {
  await go(id);
  await page.fill('textarea', 'Hello world\nПривет\n\nend');
  await page.waitForTimeout(300);
  const s = await text('.stats');
  check(id === 'character-counter' ? /Characters\s*2[0-9]/.test(s) : /Lines\s*4/.test(s), `${id}: ${s}`);
});

for (const r of results) console.log(r);
if (errors.length) failures++;
console.log(errors.length ? `✗ console errors:\n${errors.join('\n')}` : '✓ no console errors');
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
await browser.close();
process.exit(failures ? 1 : 0);
