import { h, render, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor } from '../../components/textEditor';
import { notice, kvTable, errorPanel } from '../../components/ui';
import { decodeJwt } from './lib';
import { highlightJson } from '../data/jsonFormatter';
import { formatDate } from '../../utils/format';
import { t } from '../../i18n/i18n';

const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFubiBFeGFtcGxlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDAsInJvbGVzIjpbImFkbWluIl19.signature-not-verified';

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'stack', 'aria-live': 'polite' });
  let used = false;
  const run = () => {
    const tok = input.value.trim();
    if (!tok) return render(out);
    try {
      const { header, payload, signature } = decodeJwt(tok);
      const claims = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const now = Date.now() / 1000;
      const time = (k: string): [string, string] | null => (typeof claims[k] === 'number' ? [k, `${formatDate((claims[k] as number) * 1000)} (${claims[k]})`] : null);
      const exp = typeof claims.exp === 'number' ? (claims.exp as number) : null;
      const nbf = typeof claims.nbf === 'number' ? (claims.nbf as number) : null;
      render(
        out,
        exp !== null
          ? exp < now
            ? notice('error', h('strong', null, t('Expired')), ` ${formatDate(exp * 1000)}`)
            : notice('success', h('strong', null, t('Not expired')), ` — ${t('valid until {date}', { date: formatDate(exp * 1000) })}`)
          : notice('info', t('No “exp” claim: this token does not expire by itself.')),
        nbf !== null && nbf > now ? notice('warn', t('Not valid before {date}.', { date: formatDate(nbf * 1000) })) : null,
        h('div', { class: 'editor-grid' },
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('Header (alg: {alg})', { alg: String(header.alg ?? '?') })), h('pre', { class: 'code-view' }, highlightJson(JSON.stringify(header, null, 2)))),
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('Payload')), h('pre', { class: 'code-view' }, highlightJson(JSON.stringify(payload, null, 2)))),
        ),
        kvTable([time('iat'), time('nbf'), time('exp'), claims.iss ? ['iss', String(claims.iss)] : null, claims.sub ? ['sub', String(claims.sub)] : null, claims.aud ? ['aud', JSON.stringify(claims.aud)] : null, [t('Signature'), signature ? `${signature.slice(0, 40)}${signature.length > 40 ? '…' : ''}` : t('(none — unsecured token)')]].filter(Boolean) as [string, string][], t('Registered claims')),
        notice('warn', h('strong', null, t('Signature not verified. ')), t('Decoding is not validation: anyone can create a token with any payload. Verify signatures on your server with the secret or public key.')),
      );
      if (!used) {
        used = true;
        ctx.recordUse();
      }
    } catch (e) {
      render(out, errorPanel(e));
    }
  };
  const input = textEditor({ label: t('JSON Web Token'), rows: 5, sample: SAMPLE, placeholder: t('Paste a token (eyJ…)'), onInput: debounce(run, 100), accept: ['txt'] });
  root.append(notice('info', t('Tokens are decoded locally — they are never sent anywhere. Still, avoid pasting production secrets into any website you do not control.')), input.el, out);
};
