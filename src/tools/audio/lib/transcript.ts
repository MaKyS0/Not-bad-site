/**
 * Helpers for speech recognition: splitting long audio into model-sized
 * windows at quiet moments, and writing transcripts as TXT / SRT / WebVTT.
 * Pure functions (no DOM) — unit tested.
 */

export const ASR_RATE = 16_000;

export interface Segment {
  start: number;
  end: number;
  text: string;
}

/**
 * Split samples into windows of at most `maxSec` seconds. Instead of cutting
 * blindly at the limit (which splits words), each cut is moved to the quietest
 * 30 ms frame within the last `searchSec` seconds of the window.
 */
export function splitAtPauses(samples: Float32Array, rate = ASR_RATE, maxSec = 28, searchSec = 4): [number, number][] {
  const max = Math.floor(maxSec * rate);
  const search = Math.floor(searchSec * rate);
  const frame = Math.max(1, Math.floor(0.03 * rate));
  const out: [number, number][] = [];
  let start = 0;
  while (samples.length - start > max) {
    let best = start + max;
    let bestEnergy = Infinity;
    for (let f = start + max - search; f + frame <= start + max; f += frame) {
      let e = 0;
      for (let i = f; i < f + frame; i++) e += samples[i] * samples[i];
      if (e < bestEnergy) {
        bestEnergy = e;
        best = f + (frame >> 1);
      }
    }
    out.push([start, best]);
    start = best;
  }
  if (samples.length - start > rate * 0.1 || !out.length) out.push([start, samples.length]);
  return out;
}

/** True when a window is (almost) silent and not worth sending to the model. */
export function isSilent(samples: Float32Array, threshold = 0.004): boolean {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length)) < threshold;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Whisper sometimes gets stuck repeating one phrase ("hallucination loop"),
 * especially the small model on noisy audio. Drop segments that repeat the
 * previous one and collapse a phrase repeated 3+ times inside a segment.
 */
export function dropRepeats(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    const text = seg.text.replace(/(\S.{5,}?)(?:\s*\1){2,}/gu, '$1');
    const prev = out[out.length - 1];
    if (prev && norm(text) && norm(prev.text) === norm(text)) {
      prev.end = Math.max(prev.end, seg.end);
      continue;
    }
    out.push({ ...seg, text });
  }
  return out;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function stamp(sec: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}
/** "1:05" / "1:02:03" for display next to transcript lines. */
export function shortStamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

const clean = (segments: Segment[]) => segments.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text);

export function toTxt(segments: Segment[], timestamps = false): string {
  const list = clean(segments);
  return timestamps ? list.map((s) => `[${shortStamp(s.start)}] ${s.text}`).join('\n') + '\n' : list.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim() + '\n';
}

export function toSrt(segments: Segment[]): string {
  return clean(segments)
    .map((s, i) => `${i + 1}\n${stamp(s.start, ',')} --> ${stamp(Math.max(s.end, s.start + 0.5), ',')}\n${s.text}\n`)
    .join('\n');
}

export function toVtt(segments: Segment[]): string {
  return `WEBVTT\n\n${clean(segments)
    .map((s) => `${stamp(s.start, '.')} --> ${stamp(Math.max(s.end, s.start + 0.5), '.')}\n${s.text}\n`)
    .join('\n')}`;
}
