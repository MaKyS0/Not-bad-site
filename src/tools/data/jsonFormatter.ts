import { h, render, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { button, checkbox, field, select, progress } from '../../components/ui';
import { formatJson, tokenizeJson } from './lib/json';
import { WorkerPool } from '../../workers/rpc';
import { describeError } from '../../utils/errors';
import { copyText, downloadBlob } from '../../services/download';
import { baseName, formatBytes } from '../../utils/format';

const SAMPLE = '{"name":"Universal File Toolbox","private":true,"tools":["json","csv","xml"],"stats":{"users":1024,"rating":4.9,"offline":true,"backend":null}}';
const HIGHLIGHT_LIMIT = 400_000;
const WORKER_THRESHOLD = 1_000_000;

let pool: WorkerPool | null = null;
const dataWorker = () => (pool ??= new WorkerPool(() => new Worker(new URL('../../workers/data.worker.ts', import.meta.url), { type: 'module' }), 1));

export function highlightJson(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const [type, value] of tokenizeJson(text)) {
    if (type === 'ws') frag.append(value);
    else frag.append(h('span', { class: `tok-${type}` }, value));
  }
  return frag;
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ indent: '2', sortKeys: false, live: true });
  let lastOutput = '';
  let used = false;
  const status = h('p', { class: 'status-line', role: 'status' });
  const prog = progress('Parsing…');
  const outPre = h('pre', { class: 'code-view', tabindex: '0', 'aria-label': 'Formatted JSON' });
  const copyBtn = button('Copy', { variant: 'secondary', size: 'sm', icon: 'copy', onClick: () => void copyText(lastOutput) });
  const dlBtn = button('Download', { variant: 'secondary', size: 'sm', icon: 'download', onClick: () => void downloadBlob(new Blob([lastOutput], { type: 'application/json' }), `${input.fileName ? baseName(input.fileName) : 'data'}.json`) });
  const outInfo = h('span', { class: 'hint toolbar-end' });

  const input = textEditor({ label: 'JSON input', placeholder: 'Paste JSON here or open a .json file…', accept: ctx.meta.supportedFormats, onInput: debounce(() => s.live && run('format'), 250), rows: 18, sample: SAMPLE, maxBytes: 200 * 1024 * 1024 });

  const indentSel = field('Indentation', select([{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tabs' }], s.indent, (v) => { s.indent = v; ctx.saveSettings(s); run('format'); }));
  const sortKeys = checkbox('Sort keys A→Z', s.sortKeys, (v) => { s.sortKeys = v; ctx.saveSettings(s); run('format'); });
  const live = checkbox('Format as I type', s.live, (v) => { s.live = v; ctx.saveSettings(s); });

  async function run(action: 'format' | 'minify' | 'validate') {
    const text = input.value;
    if (!text.trim()) {
      lastOutput = '';
      render(outPre);
      status.textContent = '';
      status.className = 'status-line';
      copyBtn.disabled = dlBtn.disabled = true;
      outInfo.textContent = '';
      return;
    }
    const opts = { indent: s.indent === 'tab' ? ('\t' as const) : Number(s.indent), sortKeys: s.sortKeys, minify: action === 'minify' };
    try {
      let out: string;
      if (text.length > WORKER_THRESHOLD) {
        prog.indeterminate(`Parsing ${formatBytes(text.length)}…`);
        out = await dataWorker().call<string>('formatJson', { text, ...opts }, { signal: ctx.signal });
      } else out = formatJson(text, opts);
      status.className = 'status-line status-ok';
      status.textContent = '✓ Valid JSON';
      if (action === 'validate') return;
      lastOutput = out;
      copyBtn.disabled = dlBtn.disabled = false;
      outInfo.textContent = `${out.split('\n').length.toLocaleString()} lines · ${formatBytes(new Blob([out]).size)}`;
      if (out.length <= HIGHLIGHT_LIMIT) render(outPre, highlightJson(out));
      else outPre.textContent = out;
      if (!used) {
        used = true;
        ctx.recordUse(s);
      }
    } catch (e) {
      const f = describeError(e);
      status.className = 'status-line status-err';
      status.textContent = `✗ ${f.title}${f.message ? ` — ${f.message}` : ''}`;
      // Jump to the error position in the input.
      const m = /line (\d+), column (\d+)/.exec(f.title);
      if (m && action !== 'format') {
        const lines = text.split('\n');
        const pos = lines.slice(0, Number(m[1]) - 1).reduce((a, l) => a + l.length + 1, 0) + Number(m[2]) - 1;
        input.textarea.focus();
        input.textarea.setSelectionRange(pos, Math.min(text.length, pos + 1));
      }
    } finally {
      prog.hide();
    }
  }

  copyBtn.disabled = dlBtn.disabled = true;
  root.append(
    h('div', { class: 'panel stack' },
      h('div', { class: 'toolbar', style: 'gap:12px' },
        button('Format', { variant: 'primary', icon: 'braces', onClick: () => void run('format') }),
        button('Minify', { variant: 'secondary', icon: 'compress', onClick: () => void run('minify') }),
        button('Validate', { variant: 'secondary', icon: 'check', onClick: () => void run('validate') }),
      ),
      h('div', { class: 'options-grid' }, indentSel, h('div', { class: 'stack-sm' }, sortKeys.el, live.el)),
      status,
      prog.el,
    ),
    h('div', { class: 'editor-grid' },
      input.el,
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Output'), h('div', { class: 'toolbar' }, copyBtn, dlBtn, outInfo), outPre),
    ),
  );
  if (ctx.initialFiles[0]) {
    await loadIntoEditor(input, ctx.initialFiles[0]);
    void run('format');
  }
};
