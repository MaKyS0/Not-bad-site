import { h, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { outputPanel } from '../../components/output';
import { button, checkbox, field, select } from '../../components/ui';
import { formatXml, minifyXml } from './lib/xml';
import { baseName, extOf } from '../../utils/format';
import { t } from '../../i18n/i18n';

const SAMPLE = '<?xml version="1.0" encoding="UTF-8"?><catalog><!-- sample --><book id="bk101" lang="en"><author>Gambardella, Matthew</author><title>XML Developer&apos;s Guide</title><price currency="USD">44.95</price><description><![CDATA[An in-depth look at <XML>.]]></description></book><book id="bk102"/></catalog>';

/** Check well-formedness with the browser's XML parser. Returns an error message or null. */
export function xmlError(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (!err) return null;
  // Chrome nests the message in a <div>; Firefox puts it in the element text.
  const msg = (err.querySelector('div')?.textContent ?? err.textContent ?? 'Unknown error').trim();
  return msg.replace(/\s+/g, ' ').replace(/^This page contains the following errors:\s*/i, '').replace(/Below is a rendering.*$/i, '').slice(0, 300);
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ indent: '2', removeComments: false });
  let used = false;
  let lastAction: 'format' | 'minify' = 'format';
  const input = textEditor({ label: t('XML input'), accept: ctx.meta.supportedFormats, rows: 18, sample: SAMPLE, placeholder: t('Paste XML here or open a file…'), onInput: debounce(() => run(lastAction), 250) });
  const output = outputPanel({ label: t('Output'), rows: 18, mime: 'application/xml', fileName: () => (input.fileName ? `${baseName(input.fileName)}.${extOf(input.fileName) || 'xml'}` : 'formatted.xml') });

  function run(action: 'format' | 'minify' | 'validate') {
    if (action !== 'validate') lastAction = action;
    const text = input.value;
    if (!text.trim()) {
      output.set('');
      output.setStatus('');
      return;
    }
    const err = xmlError(text);
    if (err) {
      output.setStatus(`✗ ${t('Not well-formed XML:')} ${err}`, 'err');
      if (action !== 'validate') output.set('');
      return;
    }
    output.setStatus(`✓ ${t('Well-formed XML (syntax only — no schema/DTD validation)')}`, 'ok');
    if (action === 'validate') return;
    const indent = s.indent === 'tab' ? '\t' : ' '.repeat(Number(s.indent));
    output.set(action === 'format' ? formatXml(text, indent) : minifyXml(text, s.removeComments));
    if (!used) {
      used = true;
      ctx.recordUse(s);
    }
  }

  root.append(
    h('div', { class: 'panel stack' },
      h('div', { class: 'toolbar' },
        button(t('Format'), { variant: 'primary', icon: 'code', onClick: () => run('format') }),
        button(t('Minify'), { variant: 'secondary', icon: 'compress', onClick: () => run('minify') }),
        button(t('Validate'), { variant: 'secondary', icon: 'check', onClick: () => run('validate') }),
      ),
      h('div', { class: 'options-grid' },
        field(t('Indentation'), select([{ value: '2', label: t('2 spaces') }, { value: '4', label: t('4 spaces') }, { value: 'tab', label: t('Tabs') }], s.indent, (v) => { s.indent = v; ctx.saveSettings(s); run(lastAction); })),
        checkbox(t('Minify: remove comments'), s.removeComments, (v) => { s.removeComments = v; ctx.saveSettings(s); if (lastAction === 'minify') run('minify'); }).el,
      ),
    ),
    h('div', { class: 'editor-grid' }, input.el, output.el),
  );
  if (ctx.initialFiles[0]) {
    await loadIntoEditor(input, ctx.initialFiles[0]);
    run('format');
  }
};
