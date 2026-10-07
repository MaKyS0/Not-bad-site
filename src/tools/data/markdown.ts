import { h, debounce, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { button, errorPanel } from '../../components/ui';
import { markdownToHtml } from './lib/markdown';
import { copyText, downloadBlob } from '../../services/download';
import { baseName } from '../../utils/format';
import { getLang, t } from '../../i18n/i18n';

const SAMPLE = `# Universal File Toolbox

Process files **privately** in your browser — *no uploads*.

## Features
- [x] Image compression
- [x] PDF merge & split
- [ ] Your next idea

| Tool | Runs where |
|------|:----------:|
| JSON Formatter | Browser |
| ZIP Creator | Browser |

> Raw HTML like <script>alert(1)</script> is shown as text, never executed.

\`\`\`js
console.log('hello');
\`\`\`

[Source on GitHub](https://github.com)
`;

const EXPORT_CSS = 'body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.65;color:#1f2937}pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow:auto}code{background:#f3f4f6;padding:1px 5px;border-radius:4px}pre code{background:none;padding:0}blockquote{margin:0 0 1em;padding-left:14px;border-left:3px solid #d1d5db;color:#4b5563}table{border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:6px 10px}li.task{list-style:none}';

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  let used = false;
  const preview = h('div', { class: 'markdown-body', 'aria-live': 'off', 'aria-label': t('Preview') });
  let html = '';
  const update = (fromUser = true) => {
    try {
      html = markdownToHtml(input.value);
    } catch (e) {
      html = '';
      render(preview, errorPanel(e));
      return;
    }
    // Safe: markdownToHtml escapes all text and only emits a fixed set of tags.
    preview.innerHTML = html;
    if (fromUser && input.value && !used) {
      used = true;
      ctx.recordUse();
    }
  };
  const input = textEditor({ label: t('Markdown'), accept: ctx.meta.supportedFormats, rows: 22, sample: SAMPLE, onInput: debounce(() => update(), 120), placeholder: t('# Write Markdown here…') });
  const fullHtml = () => `<!doctype html>\n<html lang="${getLang()}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${(input.fileName ? baseName(input.fileName) : 'Document').replace(/</g, '&lt;')}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
  root.append(
    h('div', { class: 'toolbar' },
      button(t('Download HTML'), { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(new Blob([fullHtml()], { type: 'text/html' }), `${input.fileName ? baseName(input.fileName) : 'document'}.html`) }),
      button(t('Copy HTML'), { variant: 'secondary', icon: 'copy', onClick: () => void copyText(html) }),
    ),
    h('div', { class: 'editor-grid' }, input.el, h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('Preview')), preview)),
  );
  if (ctx.initialFiles[0]) await loadIntoEditor(input, ctx.initialFiles[0]);
  else {
    input.value = SAMPLE;
    update(false);
  }
};
