import { h, render, debounce } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { outputPanel } from '../../components/output';
import { checkbox, segmented, button, errorPanel, notice, progress } from '../../components/ui';
import { dropzone } from '../../components/dropzone';
import { encodeBase64Text, decodeBase64Text, base64ToBytes, bytesToBase64, urlEncode, urlDecode, htmlEncode, htmlDecode } from './lib/codec';
import { describeError } from '../../utils/errors';
import { downloadBlob, copyText } from '../../services/download';
import { formatBytes } from '../../utils/format';
import { sniffBytes } from '../../utils/fileType';
import { t, translateMessage } from '../../i18n/i18n';

type Codec = 'base64' | 'url' | 'html';
type Dir = 'encode' | 'decode';

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const codec = ((ctx.preset as { codec?: Codec }).codec ?? 'base64') as Codec;
  const s = await ctx.loadSettings({ dir: 'encode' as Dir, mode: 'text' as 'text' | 'file', urlSafe: false, wrap: false, component: true, plusSpace: true, nonAscii: false });
  let used = false;

  const input = textEditor({ label: t('Input'), accept: ['*'], onInput: debounce(() => run(), 80), rows: 12, placeholder: t('Type or paste here…') });
  const output = outputPanel({ label: t('Output'), rows: 12, fileName: () => `${s.dir}d.txt`, onUseAsInput: (t) => { input.value = t; s.dir = s.dir === 'encode' ? 'decode' : 'encode'; dirSeg.set(s.dir); run(); } });

  const dirSeg = segmented<Dir>(t('Direction'), [{ value: 'encode', label: t('Encode') }, { value: 'decode', label: t('Decode') }], s.dir, (v) => { s.dir = v; save(); run(); });
  const save = () => ctx.saveSettings(s);
  const optsBox = h('div', { class: 'stack-sm' });
  if (codec === 'base64') {
    optsBox.append(
      checkbox(t('URL-safe (Base64URL, no padding)'), s.urlSafe, (v) => { s.urlSafe = v; save(); run(); }).el,
      checkbox(t('Wrap lines at 76 characters (MIME)'), s.wrap, (v) => { s.wrap = v; save(); run(); }).el,
    );
  } else if (codec === 'url') {
    optsBox.append(
      checkbox(t('Encode everything (encodeURIComponent) — off keeps : / ? & = #'), s.component, (v) => { s.component = v; save(); run(); }).el,
      checkbox(t('Decode “+” as space'), s.plusSpace, (v) => { s.plusSpace = v; save(); run(); }).el,
    );
  } else {
    optsBox.append(checkbox(t('Also encode all non-ASCII characters (&#x…;)'), s.nonAscii, (v) => { s.nonAscii = v; save(); run(); }).el);
  }

  function run() {
    const t = input.value;
    if (!t) {
      output.set('');
      output.setStatus('');
      return;
    }
    try {
      let out: string;
      if (codec === 'base64') out = s.dir === 'encode' ? encodeBase64Text(t, { urlSafe: s.urlSafe, wrap: s.wrap }) : decodeBase64Text(t);
      else if (codec === 'url') out = s.dir === 'encode' ? urlEncode(t, s.component ? 'component' : 'uri') : urlDecode(t, s.plusSpace);
      else out = s.dir === 'encode' ? htmlEncode(t, s.nonAscii ? 'nonascii' : 'basic') : htmlDecode(t);
      output.set(out);
      output.setStatus(`${t.length.toLocaleString()} → ${out.length.toLocaleString()} characters`, 'ok');
      if (!used) {
        used = true;
        ctx.recordUse();
      }
    } catch (e) {
      output.set('');
      const f = describeError(e);
      output.setStatus(`${f.title} ${f.message}`, 'err');
    }
  }

  const textArea = h('div', { class: 'editor-grid' }, input.el, output.el);

  // ---- Base64 file mode ----
  const fileArea = h('div', { class: 'stack' });
  if (codec === 'base64') {
    const result = h('div', { 'aria-live': 'polite' });
    const prog = progress(t('Encoding…'));
    const enc = dropzone({
      accept: ['*'],
      multiple: false,
      compact: true,
      title: t('File → Base64: drop any file'),
      onFiles: async ([file]) => {
        render(result);
        try {
          if (file.size > 30 * 1024 * 1024) throw new Error(t('File too large for Base64 text output ({size}). Base64 is ~33 % larger than the file; keep it under 30 MB.', { size: formatBytes(file.size) }));
          prog.indeterminate(t('Encoding…'));
          const b64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
          const dataUri = `data:${file.type || 'application/octet-stream'};base64,${b64}`;
          const out = outputPanel({ label: t('Base64 of {name} ({size})', { name: file.name, size: formatBytes(b64.length) }), rows: 8, fileName: () => `${file.name}.b64.txt` });
          out.set(b64.length > 5_000_000 ? `${b64.slice(0, 5_000_000)}\n… ${t('(truncated in preview — use Copy or Download for the full text)')}` : b64);
          render(result, out.el, h('div', { class: 'toolbar' },
            button(t('Copy full Base64'), { icon: 'copy', onClick: () => void copyText(b64) }),
            button(t('Copy as data URI'), { icon: 'copy', onClick: () => void copyText(dataUri) }),
            button(t('Download .txt'), { icon: 'download', onClick: () => void downloadBlob(new Blob([b64], { type: 'text/plain' }), `${file.name}.b64.txt`) }),
          ));
          ctx.recordUse();
        } catch (e) {
          render(result, errorPanel(e));
        } finally {
          prog.hide();
        }
      },
    });
    const decIn = textEditor({ label: t('Base64 → File: paste Base64 or a data URI'), rows: 6, accept: ['txt', 'b64', 'base64'] });
    const decBtn = button(t('Decode to file'), {
      variant: 'primary',
      icon: 'download',
      onClick: async () => {
        render(result);
        try {
          const bytes = base64ToBytes(decIn.value);
          const mimeFromUri = /^data:([^;,]+)/.exec(decIn.value.trim())?.[1];
          const sniff = sniffBytes(bytes.subarray(0, 512));
          const ext = sniff?.ext ?? 'bin';
          const blob = new Blob([bytes as BlobPart], { type: mimeFromUri ?? sniff?.mime ?? 'application/octet-stream' });
          render(result, notice('success', `${t('Decoded {size}', { size: formatBytes(bytes.length) })}${sniff ? ` — ${t('looks like: {type}', { type: translateMessage(sniff.label) })}` : ''}.`));
          await downloadBlob(blob, `decoded.${ext}`);
          ctx.recordUse();
        } catch (e) {
          render(result, errorPanel(e));
        }
      },
    });
    fileArea.append(enc, prog.el, decIn.el, h('div', { class: 'toolbar' }, decBtn), result);
  }

  const modeSeg = codec === 'base64'
    ? segmented<'text' | 'file'>(t('Mode'), [{ value: 'text', label: t('Text') }, { value: 'file', label: t('File') }], s.mode, (v) => { s.mode = v; save(); syncMode(); })
    : null;
  function syncMode() {
    const file = codec === 'base64' && s.mode === 'file';
    textArea.hidden = file;
    dirSeg.el.hidden = file;
    optsBox.hidden = file;
    fileArea.hidden = !file;
  }

  root.append(h('div', { class: 'panel stack' }, h('div', { class: 'toolbar', style: 'gap:16px;align-items:flex-start' }, modeSeg?.el, dirSeg.el), optsBox), textArea, fileArea);
  syncMode();
  run();
  if (ctx.initialFiles[0]) {
    if (codec === 'base64' && !/^text\//.test(ctx.initialFiles[0].type)) {
      s.mode = 'file';
      modeSeg?.set('file');
      syncMode();
    } else await loadIntoEditor(input, ctx.initialFiles[0]);
  }
};
