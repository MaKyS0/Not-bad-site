import { h, render, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { statGrid, kvTable } from '../../components/ui';
import { textStats } from './lib/text';
import { formatBytes } from '../../utils/format';

const fmtMin = (m: number): string => (m < 1 ? `${Math.max(0, Math.round(m * 60))} sec` : `${Math.floor(m)} min ${Math.round((m % 1) * 60)} sec`);

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const focus = (ctx.preset as { focus?: string }).focus;
  const stats = h('div', { 'aria-live': 'polite' });
  const extra = h('div');
  let used = false;
  const update = debounce((text: string) => {
    const s = textStats(text);
    const items: [string, string][] = [
      ['Words', s.words.toLocaleString()],
      ['Characters', s.characters.toLocaleString()],
      ['Without spaces', s.charactersNoSpaces.toLocaleString()],
      ['Lines', s.lines.toLocaleString()],
      ['Sentences', s.sentences.toLocaleString()],
      ['Paragraphs', s.paragraphs.toLocaleString()],
    ];
    if (focus === 'characters') items.unshift(items.splice(1, 1)[0], items.splice(1, 1)[0]);
    if (focus === 'lines') items.unshift(items.splice(3, 1)[0]);
    render(stats, statGrid(items));
    render(
      extra,
      h('div', { class: 'editor-grid' },
        kvTable([
          ['Non-empty lines', s.nonEmptyLines.toLocaleString()],
          ['Empty lines', (s.lines - s.nonEmptyLines).toLocaleString()],
          ['Unique words', s.uniqueWords.toLocaleString()],
          ['Size (UTF-8)', `${formatBytes(s.bytesUtf8)} (${s.bytesUtf8.toLocaleString()} bytes)`],
          ['Reading time', fmtMin(s.readingMinutes)],
          ['Speaking time', fmtMin(s.speakingMinutes)],
        ], 'Details'),
        s.topWords.length ? kvTable(s.topWords.map(([w, c]) => [w, `${c}×`]), 'Most frequent words') : h('div'),
      ),
    );
    if (text && !used) {
      used = true;
      ctx.recordUse();
    }
  }, 120);
  const ed = textEditor({ label: 'Your text', placeholder: 'Type or paste text here, or open a .txt file…', accept: ctx.meta.supportedFormats, encoding: true, onInput: update, rows: 10 });
  root.append(stats, ed.el, extra);
  update('');
  ed.textarea.focus({ preventScroll: true });
  if (ctx.initialFiles[0]) void loadIntoEditor(ed, ctx.initialFiles[0]);
};
