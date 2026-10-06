/**
 * Encoders/decoders: Base64 (UTF-8 safe, URL-safe variant), URL, HTML entities.
 */
import { UserError } from '../../../utils/errors';

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function base64ToBytes(input: string): Uint8Array {
  let s = input.trim();
  const m = /^data:([^;,]*)(;[^,]*)?,/.exec(s);
  if (m) s = s.slice(m[0].length);
  s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (/[^A-Za-z0-9+/=]/.test(s)) throw new UserError('The input is not valid Base64.', 'Base64 may only contain A–Z, a–z, 0–9, +, / (or - and _ for Base64URL) and = padding.');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new UserError('The Base64 input has an invalid length.', 'It may be truncated.');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeBase64Text(text: string, opts: { urlSafe?: boolean; wrap?: boolean } = {}): string {
  let out = bytesToBase64(new TextEncoder().encode(text));
  if (opts.urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (opts.wrap) out = out.replace(/(.{76})/g, '$1\n').trimEnd();
  return out;
}

export function decodeBase64Text(b64: string): string {
  const bytes = base64ToBytes(b64);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new UserError('Decoded data is binary, not UTF-8 text.', 'Switch to “File” mode to download the decoded bytes as a file.');
  }
}

export function urlEncode(s: string, mode: 'component' | 'uri' = 'component'): string {
  return mode === 'component' ? encodeURIComponent(s) : encodeURI(s);
}

export function urlDecode(s: string, plusAsSpace = true): string {
  try {
    return decodeURIComponent(plusAsSpace ? s.replace(/\+/g, ' ') : s);
  } catch {
    throw new UserError('The input contains an invalid percent-encoded sequence.', 'Check for “%” characters that are not followed by two hex digits.');
  }
}

const BASIC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function htmlEncode(s: string, mode: 'basic' | 'nonascii' = 'basic'): string {
  let out = s.replace(/[&<>"']/g, (c) => BASIC[c]);
  if (mode === 'nonascii') out = Array.from(out, (c) => (c.codePointAt(0)! > 126 ? `&#x${c.codePointAt(0)!.toString(16).toUpperCase()};` : c)).join('');
  return out;
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', euro: '€', pound: '£', yen: '¥', cent: '¢', deg: '°', times: '×', divide: '÷',
  middot: '·', bull: '•', sect: '§', para: '¶', plusmn: '±', frac12: '½', frac14: '¼', frac34: '¾', larr: '←', rarr: '→', uarr: '↑', darr: '↓',
};

/**
 * Decode HTML entities. In the browser the full HTML5 entity table is used via
 * an inert DOMParser document (no scripts run, no resources load); a built-in
 * table covers the common entities elsewhere.
 */
export function htmlDecode(s: string): string {
  if (typeof DOMParser !== 'undefined') {
    // Neutralise tags first so only entities are interpreted.
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${s.replace(/</g, '&lt;')}`, 'text/html');
    return doc.body.textContent ?? '';
  }
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}
