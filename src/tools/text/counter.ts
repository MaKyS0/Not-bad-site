import { h, render, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { statGrid, kvTable } from '../../components/ui';
import { textStats } from './lib/text';
import { formatBytes } from '../../utils/format';
import { plural, t } from '../../i18n/i18n';

const fmtMin = (m: number): string => (m < 1 ? t('{s} sec', { s: Math.max(0, Math.round(m * 60)) }) : t('{m} min {s} sec', { m: Math.floor(m), s: Math.round((m % 1) * 60) }));

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const focus = (ctx.preset as { focus?: string }).focus;
  const stats = h('div', { 'aria-live': 'polite' });
  const extra = h('div');
  let used = false;
  const update = debounce((text: string) => {
    const s = textStats(text);
    const items: [string, string][] = [
      [t('Words'), s.words.toLocaleString()],
      [t('Characters'), s.characters.toLocaleString()],
      [t('Without spaces'), s.charactersNoSpaces.toLocaleString()],
      [t('Lines'), s.lines.toLocaleString()],
      [t('Sentences'), s.sentences.toLocaleString()],
      [t('Paragraphs'), s.paragraphs.toLocaleString()],
    ];
    if (focus === 'characters') items.unshift(items.splice(1, 1)[0], items.splice(1, 1)[0]);
    if (focus === 'lines') items.unshift(items.splice(3, 1)[0]);
    render(stats, statGrid(items));
    render(
      extra,
      h('div', { class: 'editor-grid' },
        kvTable([
          [t('Non-empty lines'), s.nonEmptyLines.toLocaleString()],
          [t('Empty lines'), (s.lines - s.nonEmptyLines).toLocaleString()],
          [t('Unique words'), s.uniqueWords.toLocaleString()],
          [t('Size (UTF-8)'), `${formatBytes(s.bytesUtf8)} (${plural(s.bytesUtf8, 'byte')})`],
          [t('Reading time'), fmtMin(s.readingMinutes)],
          [t('Speaking time'), fmtMin(s.speakingMinutes)],
        ], t('Details')),
        s.topWords.length ? kvTable(s.topWords.map(([w, c]) => [w, `${c}×`]), t('Most frequent words')) : h('div'),
      ),
    );
    if (text && !used) {
      used = true;
      ctx.recordUse();
    }
  }, 120);
  const ed = textEditor({ label: t('Your text'), placeholder: t('Type or paste text here, or open a .txt file…'), accept: ctx.meta.supportedFormats, encoding: true, onInput: update, rows: 10 });
  root.append(stats, ed.el, extra);
  update('');
  ed.textarea.focus({ preventScroll: true });
  if (ctx.initialFiles[0]) void loadIntoEditor(ed, ctx.initialFiles[0]);
};
