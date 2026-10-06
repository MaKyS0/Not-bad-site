/**
 * Renders public/icons/icon.svg into the PNG icons, favicon.ico and the Open
 * Graph image using headless Chromium. Run once after changing the logo:
 *   npm run icons
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = readFileSync(`${dir}icon.svg`, 'utf8');
const exe = process.env.CHROMIUM_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();

async function render(html, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
}

const icon = (size) => render(`<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`, size, size);
// Maskable: full-bleed background, logo inside the 80 % safe zone.
const maskable = (size) =>
  render(
    `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#6366f1,#a855f7);display:grid;place-items:center">${svg
      .replace('<svg ', `<svg width="${size * 0.8}" height="${size * 0.8}" `)
      .replace(/<rect[^>]*\/>/, '')}</div>`,
    size,
    size,
  );

const outputs = {
  'icon-192.png': await icon(192),
  'icon-512.png': await icon(512),
  'maskable-512.png': await maskable(512),
  'apple-touch-icon.png': await maskable(180),
};
for (const [name, buf] of Object.entries(outputs)) writeFileSync(dir + name, buf);

// favicon.ico with 16/32/48 PNG entries
const entries = [16, 32, 48];
const pngs = [];
for (const s of entries) pngs.push(await icon(s));
const header = Buffer.alloc(6 + 16 * entries.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
writeFileSync(fileURLToPath(new URL('../public/favicon.ico', import.meta.url)), Buffer.concat([header, ...pngs]));

// Open Graph image 1200×630
const og = await render(
  `<div style="width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:80px;box-sizing:border-box;background:#0b0f17;color:#e8ecf4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="display:flex;align-items:center;gap:24px;margin-bottom:40px">${svg.replace('<svg ', '<svg width="96" height="96" ')}<span style="font-size:44px;font-weight:800">File<span style="color:#818cf8">Toolbox</span></span></div>
    <div style="font-size:64px;font-weight:800;line-height:1.1;letter-spacing:-0.03em">Free browser-based tools for your files</div>
    <div style="font-size:30px;color:#a9b4c8;margin-top:24px">Convert, compress, edit and analyze — privately. No uploads.</div>
  </div>`,
  1200,
  630,
);
writeFileSync(`${dir}og-image.png`, og);
await browser.close();
console.log('Icons written to public/icons and public/favicon.ico');
