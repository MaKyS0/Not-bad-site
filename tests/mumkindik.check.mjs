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
console.log('mumkindik: ok');
