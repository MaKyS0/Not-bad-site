import { h, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { outputPanel } from '../../components/output';
import { checkbox, field } from '../../components/ui';
import { caseOps, dedupeLines, reverseText, reverseWords, sortLines, trimText, splitLines } from './lib/text';
import { baseName } from '../../utils/format';

interface Op {
  value: string;
  label: string;
  group: string;
}

const OPS: Op[] = [
  { value: 'upper', label: 'UPPERCASE', group: 'Case' },
  { value: 'lower', label: 'lowercase', group: 'Case' },
  { value: 'title', label: 'Title Case', group: 'Case' },
  { value: 'sentence', label: 'Sentence case', group: 'Case' },
  { value: 'camel', label: 'camelCase', group: 'Case' },
  { value: 'pascal', label: 'PascalCase', group: 'Case' },
  { value: 'snake', label: 'snake_case', group: 'Case' },
  { value: 'constant', label: 'CONSTANT_CASE', group: 'Case' },
  { value: 'kebab', label: 'kebab-case', group: 'Case' },
  { value: 'dot', label: 'dot.case', group: 'Case' },
  { value: 'inverse', label: 'iNVERSE cASE', group: 'Case' },
  { value: 'alternating', label: 'aLtErNaTiNg', group: 'Case' },
  { value: 'dedupe', label: 'Remove duplicate lines', group: 'Lines' },
  { value: 'sort-asc', label: 'Sort A → Z', group: 'Lines' },
  { value: 'sort-desc', label: 'Sort Z → A', group: 'Lines' },
  { value: 'sort-natural', label: 'Natural sort (2 before 10)', group: 'Lines' },
  { value: 'sort-length', label: 'Sort by length', group: 'Lines' },
  { value: 'shuffle', label: 'Shuffle lines', group: 'Lines' },
  { value: 'reverse-lines', label: 'Reverse line order', group: 'Lines' },
  { value: 'reverse', label: 'Reverse text (characters)', group: 'Reverse' },
  { value: 'reverse-words', label: 'Reverse word order', group: 'Reverse' },
  { value: 'trim', label: 'Trim & clean whitespace', group: 'Whitespace' },
];

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const preset = (ctx.preset as { op?: string }).op ?? 'upper';
  const s = await ctx.loadSettings({ op: preset, ignoreCase: false, trimBeforeCompare: true, removeEmpty: false, trimLines: true, collapseSpaces: true, removeEmptyLines: true, removeLineBreaks: false });
  s.op = preset;
  let used = false;

  const groups = [...new Set(OPS.map((o) => o.group))];
  const opSelect = h('select', { class: 'input' }, ...groups.map((g) => h('optgroup', { label: g }, ...OPS.filter((o) => o.group === g).map((o) => h('option', { value: o.value, selected: o.value === s.op }, o.label)))));
  opSelect.value = s.op;
  opSelect.addEventListener('change', () => { s.op = opSelect.value; sync(); run(); });

  const opt = (label: string, key: keyof typeof s) => checkbox(label, s[key] as boolean, (v) => { (s as Record<string, unknown>)[key] = v; ctx.saveSettings(s); run(); });
  const dedupeOpts = h('div', { class: 'stack-sm' }, opt('Ignore case', 'ignoreCase').el, opt('Trim lines before comparing', 'trimBeforeCompare').el, opt('Remove empty lines', 'removeEmpty').el);
  const sortOpts = h('div', { class: 'stack-sm' }, opt('Ignore case', 'ignoreCase').el);
  const trimOpts = h('div', { class: 'stack-sm' }, opt('Trim each line', 'trimLines').el, opt('Collapse repeated spaces', 'collapseSpaces').el, opt('Remove empty lines', 'removeEmptyLines').el, opt('Join all lines into one', 'removeLineBreaks').el);

  const input = textEditor({ label: 'Input', placeholder: 'Paste text here…', accept: ctx.meta.supportedFormats, encoding: true, onInput: debounce(() => run(), 100), rows: 14 });
  const output = outputPanel({ label: 'Result', rows: 14, fileName: () => `${input.fileName ? baseName(input.fileName) : 'text'}-${s.op}.txt`, onUseAsInput: (t) => { input.value = t; run(); } });

  function sync() {
    dedupeOpts.hidden = s.op !== 'dedupe';
    sortOpts.hidden = !['sort-asc', 'sort-desc'].includes(s.op);
    trimOpts.hidden = s.op !== 'trim';
    ctx.saveSettings(s);
  }

  function run() {
    const t = input.value;
    let out = '';
    let status = '';
    switch (s.op) {
      case 'dedupe': {
        const r = dedupeLines(t, { ignoreCase: s.ignoreCase, trim: s.trimBeforeCompare, removeEmpty: s.removeEmpty });
        out = r.text;
        status = `${r.removed.toLocaleString()} line${r.removed === 1 ? '' : 's'} removed`;
        break;
      }
      case 'sort-asc': out = sortLines(t, 'asc', s.ignoreCase); break;
      case 'sort-desc': out = sortLines(t, 'desc', s.ignoreCase); break;
      case 'sort-natural': out = sortLines(t, 'natural'); break;
      case 'sort-length': out = sortLines(t, 'length'); break;
      case 'shuffle': out = sortLines(t, 'shuffle'); break;
      case 'reverse-lines': out = sortLines(t, 'reverse'); break;
      case 'reverse': out = reverseText(t); break;
      case 'reverse-words': out = reverseWords(t); break;
      case 'trim': out = trimText(t, { trimLines: s.trimLines, collapseSpaces: s.collapseSpaces, removeEmptyLines: s.removeEmptyLines, removeLineBreaks: s.removeLineBreaks }); break;
      default: {
        const fn = caseOps[s.op as keyof typeof caseOps];
        out = fn ? fn(t) : t;
      }
    }
    output.set(out);
    if (!status && t) status = `${splitLines(out).length.toLocaleString()} lines · ${out.length.toLocaleString()} characters`;
    output.setStatus(status);
    if (t && !used) {
      used = true;
      ctx.recordUse({ op: s.op });
    }
  }

  root.append(
    h('div', { class: 'panel stack' }, h('div', { class: 'options-grid' }, field('Operation', opSelect)), dedupeOpts, sortOpts, trimOpts),
    h('div', { class: 'editor-grid' }, input.el, output.el),
  );
  sync();
  run();
  if (ctx.initialFiles[0]) await loadIntoEditor(input, ctx.initialFiles[0]);
};
