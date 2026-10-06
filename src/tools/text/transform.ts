import { h, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { outputPanel } from '../../components/output';
import { checkbox, field } from '../../components/ui';
import { caseOps, dedupeLines, reverseText, reverseWords, sortLines, trimText, splitLines } from './lib/text';
import { baseName } from '../../utils/format';
import { plural, t } from '../../i18n/i18n';

interface Op {
  value: string;
  label: string;
  group: string;
}

const OPS: Op[] = [
  { value: 'upper', label: t('UPPERCASE'), group: 'Case' },
  { value: 'lower', label: 'lowercase', group: 'Case' },
  { value: 'title', label: t('Title Case'), group: 'Case' },
  { value: 'sentence', label: t('Sentence case'), group: 'Case' },
  { value: 'camel', label: t('camelCase'), group: 'Case' },
  { value: 'pascal', label: t('PascalCase'), group: 'Case' },
  { value: 'snake', label: 'snake_case', group: 'Case' },
  { value: 'constant', label: t('CONSTANT_CASE'), group: 'Case' },
  { value: 'kebab', label: 'kebab-case', group: 'Case' },
  { value: 'dot', label: 'dot.case', group: 'Case' },
  { value: 'inverse', label: t('iNVERSE cASE'), group: 'Case' },
  { value: 'alternating', label: t('aLtErNaTiNg'), group: 'Case' },
  { value: 'dedupe', label: t('Remove duplicate lines'), group: 'Lines' },
  { value: 'sort-asc', label: t('Sort A → Z'), group: 'Lines' },
  { value: 'sort-desc', label: t('Sort Z → A'), group: 'Lines' },
  { value: 'sort-natural', label: t('Natural sort (2 before 10)'), group: 'Lines' },
  { value: 'sort-length', label: t('Sort by length'), group: 'Lines' },
  { value: 'shuffle', label: t('Shuffle lines'), group: 'Lines' },
  { value: 'reverse-lines', label: t('Reverse line order'), group: 'Lines' },
  { value: 'reverse', label: t('Reverse text (characters)'), group: 'Reverse' },
  { value: 'reverse-words', label: t('Reverse word order'), group: 'Reverse' },
  { value: 'trim', label: t('Trim & clean whitespace'), group: 'Whitespace' },
];

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const preset = (ctx.preset as { op?: string }).op ?? 'upper';
  const s = await ctx.loadSettings({ op: preset, ignoreCase: false, trimBeforeCompare: true, removeEmpty: false, trimLines: true, collapseSpaces: true, removeEmptyLines: true, removeLineBreaks: false });
  s.op = preset;
  let used = false;

  const groups = [...new Set(OPS.map((o) => o.group))];
  const opSelect = h('select', { class: 'input' }, ...groups.map((g) => h('optgroup', { label: t(g) }, ...OPS.filter((o) => o.group === g).map((o) => h('option', { value: o.value, selected: o.value === s.op }, o.label)))));
  opSelect.value = s.op;
  opSelect.addEventListener('change', () => { s.op = opSelect.value; sync(); run(); });

  const opt = (label: string, key: keyof typeof s) => checkbox(label, s[key] as boolean, (v) => { (s as Record<string, unknown>)[key] = v; ctx.saveSettings(s); run(); });
  const dedupeOpts = h('div', { class: 'stack-sm' }, opt('Ignore case', 'ignoreCase').el, opt('Trim lines before comparing', 'trimBeforeCompare').el, opt('Remove empty lines', 'removeEmpty').el);
  const sortOpts = h('div', { class: 'stack-sm' }, opt('Ignore case', 'ignoreCase').el);
  const trimOpts = h('div', { class: 'stack-sm' }, opt('Trim each line', 'trimLines').el, opt('Collapse repeated spaces', 'collapseSpaces').el, opt('Remove empty lines', 'removeEmptyLines').el, opt('Join all lines into one', 'removeLineBreaks').el);

  const input = textEditor({ label: t('Input'), placeholder: t('Paste text here…'), accept: ctx.meta.supportedFormats, encoding: true, onInput: debounce(() => run(), 100), rows: 14 });
  const output = outputPanel({ label: t('Result'), rows: 14, fileName: () => `${input.fileName ? baseName(input.fileName) : 'text'}-${s.op}.txt`, onUseAsInput: (t) => { input.value = t; run(); } });

  function sync() {
    dedupeOpts.hidden = s.op !== 'dedupe';
    sortOpts.hidden = !['sort-asc', 'sort-desc'].includes(s.op);
    trimOpts.hidden = s.op !== 'trim';
    ctx.saveSettings(s);
  }

  function run() {
    const text = input.value;
    let out = '';
    let status = '';
    switch (s.op) {
      case 'dedupe': {
        const r = dedupeLines(text, { ignoreCase: s.ignoreCase, trim: s.trimBeforeCompare, removeEmpty: s.removeEmpty });
        out = r.text;
        status = t('{lines} removed', { lines: plural(r.removed, 'line') });
        break;
      }
      case 'sort-asc': out = sortLines(text, 'asc', s.ignoreCase); break;
      case 'sort-desc': out = sortLines(text, 'desc', s.ignoreCase); break;
      case 'sort-natural': out = sortLines(text, 'natural'); break;
      case 'sort-length': out = sortLines(text, 'length'); break;
      case 'shuffle': out = sortLines(text, 'shuffle'); break;
      case 'reverse-lines': out = sortLines(text, 'reverse'); break;
      case 'reverse': out = reverseText(text); break;
      case 'reverse-words': out = reverseWords(text); break;
      case 'trim': out = trimText(text, { trimLines: s.trimLines, collapseSpaces: s.collapseSpaces, removeEmptyLines: s.removeEmptyLines, removeLineBreaks: s.removeLineBreaks }); break;
      default: {
        const fn = caseOps[s.op as keyof typeof caseOps];
        out = fn ? fn(text) : text;
      }
    }
    output.set(out);
    if (!status && text) status = `${plural(splitLines(out).length, 'line')} · ${plural(out.length, 'character')}`;
    output.setStatus(status);
    if (text && !used) {
      used = true;
      ctx.recordUse({ op: s.op });
    }
  }

  root.append(
    h('div', { class: 'panel stack' }, h('div', { class: 'options-grid' }, field(t('Operation'), opSelect)), dedupeOpts, sortOpts, trimOpts),
    h('div', { class: 'editor-grid' }, input.el, output.el),
  );
  sync();
  run();
  if (ctx.initialFiles[0]) await loadIntoEditor(input, ctx.initialFiles[0]);
};
