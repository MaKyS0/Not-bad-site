// Run: node tests/mumkindik.check.mjs
import assert from 'node:assert/strict';
import { PROGRAMS, status, matches, sortPrograms, ics } from '../public/mumkindik/app.js';

const today = '2026-11-15';
assert.deepEqual(status('2026-11-18', today), { state: 'open', days: 3 });
assert.equal(status(today, today).state, 'open'); // deadline day still counts
assert.equal(status('2026-11-14', today).state, 'closed');
assert.equal(status(null, today).state, 'unknown');

const p = (stage, extra = {}) => ({ name: 'N', org: 'O', ru: 'r', kz: 'k', type: 'grant', stage, prize: null, deadline: null, ...extra });
assert.ok(matches(p('idea'), { stage: 'idea' }, today));
assert.ok(!matches(p('mvp'), { stage: 'idea' }, today)); // idea-only project can't enter MVP programmes
assert.ok(matches(p('idea'), { stage: 'growth' }, today));
assert.ok(!matches(p('idea'), { prize: true }, today));
assert.ok(!matches(p('idea'), { open: true }, today));
assert.ok(matches(p('idea', { name: 'Startup Garage' }), { q: ' garage ' }, today));

const order = sortPrograms([p('idea', { deadline: '2026-01-01' }), p('idea'), p('idea', { deadline: '2026-12-20' }), p('idea', { deadline: '2026-12-01' })], today);
assert.deepEqual(order.map((x) => x.deadline), ['2026-12-01', '2026-12-20', null, '2026-01-01']);

const cal = ics(p('idea', { name: 'A, B', deadline: '2026-12-31', url: 'https://x.kz' }));
assert.match(cal, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
assert.match(cal, /SUMMARY:Дедлайн: A\\, B/);

for (const x of PROGRAMS) {
  assert.ok(['competition', 'incubator', 'accelerator', 'grant'].includes(x.type), x.name);
  assert.ok(['idea', 'mvp', 'growth'].includes(x.stage), x.name);
  assert.ok(x.deadline === null || !Number.isNaN(Date.parse(x.deadline)), x.name);
  assert.ok(x.ru && x.kz && x.url.startsWith('https://'), x.name);
}


// Universities and grant data stay well-formed in both languages.
const { UNIVERSITIES, DIRECTIONS, THRESHOLDS } = await import('../public/mumkindik/app.js');
for (const u of UNIVERSITIES) {
  assert.ok(u.name && u.city.length === 2 && u.url.startsWith('https://'), u.name);
  for (const k of ['ielts', 'sat', 'ent']) assert.ok(u[k] === null || u[k].length === 2, `${u.name} ${k}`);
  for (const p of u.programs || []) assert.ok(/^B\d{3}$/.test(p[0]) && p[1] && p[2] && p[3] > 0 && p[4] <= 140, `${u.name} ${p[0]}`);
}
for (const d of [...DIRECTIONS, ...THRESHOLDS]) assert.ok(d[0] && d[1] && d[2] > 0);

// Finder: margin over last year's passing score, passing rows first.
const { fit, finderRows } = await import('../public/mumkindik/app.js');
assert.equal(fit('100', 90), 10);
assert.equal(fit(90, 90), 0);
assert.equal(fit('80', 90), -10);
for (const bad of ['', null, 'abc', '141', '-1']) assert.equal(fit(bad, 90), null, String(bad));
const unis = [{ name: 'A', programs: [['B001', 'a', 'a', 5, 100], ['B002', 'b', 'b', 50, 80]] }, { name: 'B', programs: [['B001', 'a', 'a', 9, 120], ['B003', 'c', 'c', 7, 60]] }, { name: 'C' }];
assert.deepEqual(finderRows(unis, { code: '', score: '' }).map((r) => r.p[3]), [50, 9, 7, 5]); // most grants first
assert.deepEqual(finderRows(unis, { code: 'B001', score: '' }).map((r) => r.u.name), ['B', 'A']);
assert.deepEqual(finderRows(unis, { code: '', score: '95' }).map((r) => [r.p[0], r.gap]), [['B002', 15], ['B003', 35], ['B001', -5], ['B001', -25]]); // pass by grants, then nearest miss
console.log('mumkindik data: ok');
