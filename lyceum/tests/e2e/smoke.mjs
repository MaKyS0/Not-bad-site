import { createRequire } from 'node:module';
import { startServer } from './server.mjs';
let pw;
try { pw = await import('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }
const chromium = pw.chromium || pw.default?.chromium;
const srv = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('reqfailed: ' + r.url()));
await page.goto(srv.url);
await page.waitForSelector('h1');
console.log('h1:', await page.textContent('h1'));
for (const r of ['classes', 'students', 'staff', 'new-year', 'history', 'reports', 'archive', 'import', 'settings']) {
  await page.goto(srv.url + '#/' + r);
  await page.waitForTimeout(150);
  console.log(r, '->', (await page.textContent('h1')) );
}
await page.screenshot({ path: process.env.SHOT || '/tmp/lyceum-smoke.png', fullPage: true });
console.log('errors:', errors);
await browser.close();
await srv.close();
