import { describe, expect, it } from 'vitest';
import { splitAtPauses, isSilent, toSrt, toTxt, toVtt, shortStamp, dropRepeats } from '../src/tools/audio/lib/transcript';

describe('transcript helpers', () => {
  it('splits long audio at the quietest point near the limit', () => {
    const rate = 1000;
    const s = new Float32Array(70 * rate).fill(0.5);
    s.fill(0, 26 * rate, 26 * rate + 200); // pause at 26 s
    const parts = splitAtPauses(s, rate, 28, 4);
    expect(parts[0][0]).toBe(0);
    expect(parts[0][1]).toBeGreaterThanOrEqual(26 * rate);
    expect(parts[0][1]).toBeLessThanOrEqual(26 * rate + 200);
    expect(parts.at(-1)![1]).toBe(s.length);
    for (const [a, b] of parts) expect(b - a).toBeLessThanOrEqual(28 * rate);
    expect(parts.every(([a], i) => i === 0 || a === parts[i - 1][1])).toBe(true);
    expect(splitAtPauses(new Float32Array(500), rate)).toEqual([[0, 500]]);
  });

  it('detects silence', () => {
    expect(isSilent(new Float32Array(1000))).toBe(true);
    expect(isSilent(new Float32Array(1000).fill(0.2))).toBe(false);
  });

  it('writes TXT, SRT and WebVTT', () => {
    const seg = [{ start: 0, end: 2.5, text: ' Привет. ' }, { start: 3661.2, end: 3663, text: 'Second line' }, { start: 4000, end: 4001, text: '  ' }];
    expect(toTxt(seg)).toBe('Привет. Second line\n');
    expect(toTxt(seg, true)).toBe('[0:00] Привет.\n[1:01:01] Second line\n');
    expect(toSrt(seg)).toBe('1\n00:00:00,000 --> 00:00:02,500\nПривет.\n\n2\n01:01:01,200 --> 01:01:03,000\nSecond line\n');
    expect(toVtt(seg)).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nПривет.\n\n01:01:01.200 --> 01:01:03.000\nSecond line\n');
    expect(shortStamp(65)).toBe('1:05');
  });

  it('removes hallucinated repetition loops', () => {
    const loop = [
      { start: 0, end: 2, text: 'Хочу посмотреть телевизор.' },
      { start: 2, end: 4, text: ' В общем, что это не было.' },
      { start: 4, end: 6, text: 'В общем, что это не было.' },
      { start: 6, end: 8, text: 'в общем что это не было' },
      { start: 8, end: 9, text: 'Thank you. Thank you. Thank you. Thank you.' },
    ];
    const out = dropRepeats(loop);
    expect(out.map((s) => s.text.trim())).toEqual(['Хочу посмотреть телевизор.', 'В общем, что это не было.', 'Thank you.']);
    expect(out[1].end).toBe(8);
    expect(dropRepeats([{ start: 0, end: 1, text: 'Да, да.' }, { start: 1, end: 2, text: 'Нет.' }])).toHaveLength(2);
  });
});
