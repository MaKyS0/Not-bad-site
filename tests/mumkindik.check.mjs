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
const { UNIVERSITIES, DIRECTIONS, THRESHOLDS, ENT_FACTS } = await import('../public/mumkindik/app.js');
for (const u of UNIVERSITIES) {
  assert.ok(u.name && u.city.length === 2 && u.url.startsWith('https://'), u.name);
  for (const k of ['ielts', 'sat', 'ent']) assert.ok(u[k] === null || u[k].length === 3, `${u.name} ${k}`);
  for (const p of u.programs || []) assert.ok(/^BM?\d{3}$/.test(p[0]) && p[1] && p[2] && p[3] > 0 && p[4] <= 140, `${u.name} ${p[0]}`);
}
for (const d of [...DIRECTIONS, ...THRESHOLDS]) assert.ok(d[0] && d[1] && d[2] > 0);
for (const d of ENT_FACTS) assert.ok(d.length === 3 && d.every(Boolean));

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

// Profile subjects: each group code belongs to one pair; the finder filters by pair; summary adds up a table.
const { PAIRS, pairOf, summary, QUOTAS } = await import('../public/mumkindik/app.js');
const allCodes = PAIRS.flatMap((x) => x[3].split(' '));
assert.equal(new Set(allCodes).size, allCodes.length, 'a code sits in two pairs');
assert.equal(pairOf('B057')[0], 'mi');
assert.equal(pairOf('BM086')[0], 'bc');
assert.equal(pairOf('B999'), undefined);
assert.deepEqual(finderRows(unis, { code: '', score: '', pair: 'mi' }), []); // B001–B003 are not maths + informatics
assert.deepEqual(finderRows(unis, { code: '', score: '', pair: 'bg' }).map((r) => r.p[0]), ['B002', 'B001', 'B003', 'B001']);
assert.deepEqual(summary(unis[0]), { grants: 55, min: 80, max: 100 });
assert.equal(summary(unis[2]), null);
for (const d of QUOTAS) assert.ok(d.length === 3 && d.every(Boolean));

// Calendar phases and the finder state carried in the address.
const { CALENDAR, phase, parseState, buildHash } = await import('../public/mumkindik/app.js');
assert.deepEqual(phase('2027-01-10', '2027-02-10', '2026-11-16'), { state: 'future', days: 55 });
assert.equal(phase('2027-01-10', '2027-02-10', '2027-01-10').state, 'now'); // first day counts
assert.equal(phase('2027-01-10', '2027-02-10', '2027-02-10').state, 'now'); // last day counts
assert.equal(phase('2027-01-10', '2027-02-10', '2027-02-11').state, 'past');
for (const e of CALENDAR) assert.ok(e.length === 8 && e[0] <= e[1] && e[4] && e[5], e[4]);
assert.deepEqual(CALENDAR.map((e) => e[0]), [...CALENDAR.map((e) => e[0])].sort(), 'calendar is in date order');
const { dateText } = await import('../public/mumkindik/app.js');
assert.equal(dateText('2027-01-10', 0), '10 января');
assert.equal(dateText('2027-01-10', 1), '10 қаңтар');
assert.equal(dateText('2026-09-28', 0, true), '28 сентября 2026 г.');
assert.equal(dateText('2026-12-03', 1, true), '2026 жылғы 3 желтоқсан');
const span = ics({ name: 'ЕНТ', deadline: '2027-05-10', end: '2027-07-10', url: 'https://x.kz' });
assert.ok(span.includes('DTSTART;VALUE=DATE:20270510') && span.includes('DTEND;VALUE=DATE:20270711'), 'a period covers its last day');
assert.ok(span.includes('SUMMARY:ЕНТ') && !span.includes('Дедлайн'), 'a period is not labelled as a deadline');
assert.equal(buildHash({ tab: 'finder', score: '95', pair: 'mi', code: '' }), '#finder?score=95&pair=mi');
assert.equal(buildHash({ tab: 'finder', score: '', pair: '', code: '' }), '#finder');
assert.equal(buildHash({ tab: 'finder', mode: 'tests', ielts: '6.5', sat: '', where: 'abroad' }), '#finder?mode=tests&ielts=6.5&where=abroad');
const blank = { score: '', pair: '', code: '', mode: '', ielts: '', sat: '', where: '' };
assert.deepEqual(parseState('#finder?score=95&pair=mi'), { ...blank, tab: 'finder', score: '95', pair: 'mi' });
assert.deepEqual(parseState('#finder?mode=tests&ielts=6.5&sat=1300'), { ...blank, tab: 'finder', mode: 'tests', ielts: '6.5', sat: '1300' });
assert.deepEqual(parseState('#u3'), { ...blank, tab: 'u3' });
assert.deepEqual(parseState(''), { ...blank, tab: '' });

// Study-abroad data: every text cell has both languages, every card says something and names a source.
const { ABROAD, ABROAD_FACTS, OTHER_GRANTS } = await import('../public/mumkindik/app.js');
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string' && x.trim());
for (const c of ABROAD) {
  assert.ok(pair(c.name) && ['grant', 'free', 'paid'].includes(c.way), c.name[0]);
  for (const k of ['students', 'free', 'need', 'cost', 'when']) assert.ok(c[k] === null || pair(c[k]), `${c.name[0]}.${k}`);
  assert.ok(c.free || c.cost, `${c.name[0]} says how to pay for it`);
  assert.ok(c.urls.length && c.urls.every((u) => new URL(u).protocol === 'https:'), `${c.name[0]} sources`);
}
assert.equal(new Set(ABROAD.map((c) => c.name[0])).size, ABROAD.length);
assert.equal(new Set(ABROAD.map((c) => c.id)).size, ABROAD.length);
const place = (r) => Number(r.replace('=', ''));
for (const c of ABROAD) {
  assert.match(c.id, /^[a-z]{2}$/);
  assert.ok(c.unis.length >= 3, `${c.name[0]} universities`);
  for (const u of c.unis) assert.ok(u.length === 5 && u[0] && u[1] && u[2] && /^=?\d+$/.test(u[3]) && new URL(u[4]).protocol === 'https:', u[0]);
  assert.deepEqual(c.unis.map((u) => place(u[3])), [...c.unis.map((u) => place(u[3]))].sort((a, b) => a - b), `${c.name[0]}: best place first`);
  assert.equal(new Set(c.unis.map((u) => u[0])).size, c.unis.length);
}
for (const f of ABROAD_FACTS) assert.ok(f.length === 4 && f.every(Boolean));
for (const g of OTHER_GRANTS) assert.ok(/^\d+$/.test(g[0]) && g[1] && g[2]);
for (const e of CALENDAR) assert.ok(['grant', 'paid', 'abroad'].includes(e[2]), e[4]);

// IELTS and SAT finder: a place is compared only where both sides have a number; enough first, then the nearest misses.
const { testList, testRows, ABROAD_TESTS } = await import('../public/mumkindik/app.js');
assert.equal(fit('6.5', 6, 9), 0.5);
assert.equal(fit('9.5', 6, 9), null);
assert.equal(fit('1300', 1240, 1600), 60);
const places = [
  { name: 'A', abroad: false, ielts: 6, sat: 1240 }, { name: 'B', abroad: false, ielts: 5.5, sat: null },
  { name: 'C', abroad: true, ielts: 7, sat: null }, { name: 'D', abroad: true, ielts: null, sat: 1100 },
];
const names = (q) => testRows(places, { ielts: '', sat: '', where: '', ...q }).map((r) => r.x.name + (r.state ? `:${r.state}` : ''));
assert.deepEqual(names({}), ['B', 'A', 'C', 'D']); // nothing typed: lowest IELTS minimum first, SAT-only places last
assert.deepEqual(names({ where: 'abroad' }), ['C', 'D']);
assert.deepEqual(names({ ielts: '6.5' }), ['A:pass', 'B:pass', 'C:fail']); // D sets no IELTS bar: left out
assert.deepEqual(names({ ielts: '6.5', sat: '1200' }), ['B:pass', 'D:pass', 'C:fail', 'A:fail']); // A misses SAT by 40, C misses IELTS by half a band
assert.deepEqual(names({ ielts: 'abc', sat: '99999' }), ['B', 'A', 'C', 'D']); // rubbish counts as nothing typed
const tl = testList();
assert.ok(tl.every((x) => (x.ielts !== null || x.sat !== null) && x.place.length === 2 && x.href.startsWith('#')));
assert.equal(new Set(tl.map((x) => x.name)).size, tl.length);
const nu = tl.find((x) => x.name === 'Nazarbayev University');
assert.deepEqual([nu.ielts, nu.sat, nu.abroad], [6, 1240, false]);
for (const [name, r] of Object.entries(ABROAD_TESTS)) {
  assert.ok(ABROAD.some((c) => c.unis.some((u) => u[0] === name)), `${name} is not in the university lists`);
  assert.ok(r.ielts == null || (r.ielts >= 4 && r.ielts <= 9 && r.ielts * 2 % 1 === 0), `${name} IELTS`);
  assert.ok(r.sat == null || (r.sat >= 400 && r.sat <= 1600), `${name} SAT`);
  assert.ok(r.ielts != null || r.sat != null || r.ieltsNote || r.satNote, `${name} says nothing`);
  for (const k of ['ieltsNote', 'satNote']) assert.ok(r[k] == null || pair(r[k]), `${name}.${k}`);
  assert.equal(new URL(r.url).protocol, 'https:', name);
}

// Freshness: 90 days fresh, then aging, stale after 180; every block has both languages; the page refers only to real blocks.
const { FRESH, freshness, T: TEXT } = await import('../public/mumkindik/app.js');
assert.deepEqual(freshness('2026-11-16', '2026-11-16'), { days: 0, state: 'fresh' });
assert.equal(freshness('2026-08-18', '2026-11-16').state, 'fresh'); // 90 days
assert.equal(freshness('2026-08-17', '2026-11-16').state, 'aging');
assert.equal(freshness('2026-05-20', '2026-11-16').state, 'aging'); // 180 days
assert.equal(freshness('2026-05-19', '2026-11-16').state, 'stale');
for (const d of FRESH) assert.ok(pair(d.name) && pair(d.period) && !Number.isNaN(Date.parse(d.checked)) && d.urls.every((u) => new URL(u).protocol === 'https:'), d.id);
assert.equal(new Set(FRESH.map((d) => d.id)).size, FRESH.length);
const { readFileSync } = await import('node:fs');
const html = readFileSync(new URL('../public/mumkindik/index.html', import.meta.url), 'utf8');
for (const [, ids] of html.matchAll(/data-fresh="([^"]+)"/g)) for (const id of ids.split(' ')) assert.ok(FRESH.some((d) => d.id === id), `unknown freshness block "${id}"`);
// Every label the page asks for exists as plain text in both languages, and the two languages have the same keys.
for (const [, key] of html.matchAll(/data-t="([^"]+)"/g)) for (const l of ['ru', 'kz']) assert.equal(typeof TEXT[l][key], 'string', `${l}.${key}`);
assert.deepEqual(Object.keys(TEXT.ru).sort(), Object.keys(TEXT.kz).sort());
console.log('mumkindik data: ok');
