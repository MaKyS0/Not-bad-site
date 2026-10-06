import { h, render, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor } from '../../components/textEditor';
import { segmented, kvTable, notice, button } from '../../components/ui';
import { toHex } from './lib';
import { bytesToBase64 } from '../text/lib/codec';
import { copyText } from '../../services/download';
import { routeHref } from '../../services/router';

const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ enc: 'hex' as 'hex' | 'base64', upper: false });
  const results = h('div', { 'aria-live': 'polite' });
  let used = false;
  if (!globalThis.crypto?.subtle) {
    root.append(notice('error', 'The Web Crypto API is not available. It requires a secure (HTTPS) connection.'));
    return;
  }
  const run = async () => {
    const data = new TextEncoder().encode(input.value);
    const rows: [string, HTMLElement][] = [];
    for (const algo of ALGOS) {
      const digest = new Uint8Array(await crypto.subtle.digest(algo, data));
      let out = s.enc === 'hex' ? toHex(digest) : bytesToBase64(digest);
      if (s.upper && s.enc === 'hex') out = out.toUpperCase();
      rows.push([algo, h('span', { class: 'hash-out' }, out, ' ', button('', { variant: 'ghost', size: 'sm', icon: 'copy', ariaLabel: `Copy ${algo}`, onClick: () => void copyText(out) }))]);
    }
    render(results, kvTable(rows, `Digests of ${data.length.toLocaleString()} bytes (UTF-8)`), notice('warn', 'SHA-1 is broken for security purposes — use SHA-256 or stronger. For password storage use a slow KDF (Argon2, bcrypt), not a plain hash.'));
    if (input.value && !used) {
      used = true;
      ctx.recordUse();
    }
  };
  const input = textEditor({ label: 'Text', rows: 8, placeholder: 'Type or paste text…', onInput: debounce(() => void run(), 120), accept: ['txt', 'json', 'csv', 'md'] });
  root.append(
    h('div', { class: 'toolbar', style: 'gap:16px' },
      segmented<'hex' | 'base64'>('Output', [{ value: 'hex', label: 'Hex' }, { value: 'base64', label: 'Base64' }], s.enc, (v) => { s.enc = v; ctx.saveSettings(s); void run(); }).el,
      segmented<'lower' | 'upper'>('Hex case', [{ value: 'lower', label: 'lower' }, { value: 'upper', label: 'UPPER' }], s.upper ? 'upper' : 'lower', (v) => { s.upper = v === 'upper'; ctx.saveSettings(s); void run(); }).el,
    ),
    input.el,
    results,
    h('p', { class: 'hint' }, 'Need a checksum of a file? Use the ', h('a', { href: routeHref.tool('hash-generator') }, 'File Hash tool'), '.'),
  );
  void run();
};
