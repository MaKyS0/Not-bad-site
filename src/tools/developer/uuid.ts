import { h } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { button, checkbox, field, numberInput, segmented } from '../../components/ui';
import { outputPanel } from '../../components/output';
import { uuidV4, uuidV7 } from './lib';

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ version: 'v4' as 'v4' | 'v7', count: 10, upper: false, hyphens: true, braces: false });
  const out = outputPanel({ label: 'UUIDs', rows: 14, fileName: () => `uuids-${s.version}.txt` });
  const gen = () => {
    const n = Math.max(1, Math.min(10000, Math.round(s.count) || 1));
    const list: string[] = [];
    for (let i = 0; i < n; i++) {
      let u = s.version === 'v7' ? uuidV7(Date.now()) : uuidV4();
      if (!s.hyphens) u = u.replace(/-/g, '');
      if (s.upper) u = u.toUpperCase();
      if (s.braces) u = `{${u}}`;
      list.push(u);
    }
    out.set(list.join('\n'));
    out.setStatus(`${n.toLocaleString()} UUID${n > 1 ? 's' : ''} generated with crypto.getRandomValues`, 'ok');
    ctx.saveSettings(s);
  };
  const opt = (label: string, key: 'upper' | 'hyphens' | 'braces') => checkbox(label, s[key], (v) => { s[key] = v; gen(); }).el;
  root.append(
    h('div', { class: 'panel stack' },
      h('div', { class: 'options-grid' },
        segmented<'v4' | 'v7'>('Version', [{ value: 'v4', label: 'v4 (random)' }, { value: 'v7', label: 'v7 (time-ordered)' }], s.version, (v) => { s.version = v; gen(); }).el,
        field('How many (1–10,000)', numberInput(s.count, { min: 1, max: 10000, onInput: (v) => { s.count = v; } })),
      ),
      h('div', { class: 'stack-sm' }, opt('Uppercase', 'upper'), opt('Hyphens', 'hyphens'), opt('Wrap in {braces}', 'braces')),
      h('div', { class: 'toolbar' }, button('Generate', { variant: 'primary', icon: 'zap', onClick: () => { gen(); ctx.recordUse(s); } })),
    ),
    out.el,
  );
  gen();
};
