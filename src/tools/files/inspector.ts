import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { kvTable, notice, button, progress } from '../../components/ui';
import { detectFileType } from '../../utils/fileType';
import { extOf, formatBytes, formatDate, formatDuration } from '../../utils/format';
import { hashFile } from '../../services/hashService';
import { copyText } from '../../services/download';
import { routeHref } from '../../services/router';
import { suggestTools } from '../../services/suggest';
import { describeError } from '../../utils/errors';

async function extraInfo(file: File, kind: string): Promise<[string, string][]> {
  const rows: [string, string][] = [];
  try {
    if (kind === 'image') {
      const { decodeImage } = await import('../../services/imageService');
      const d = await decodeImage(file);
      rows.push(['Dimensions', `${d.width} × ${d.height} px`]);
      d.close();
    } else if (kind === 'pdf') {
      const { openPdfJs, readFileBytes } = await import('../pdf/lib');
      const doc = await openPdfJs(await readFileBytes(file));
      rows.push(['Pages', String(doc.numPages)]);
      void doc.loadingTask.destroy();
    } else if (kind === 'audio' || kind === 'video') {
      const url = URL.createObjectURL(file);
      try {
        const el = document.createElement(kind === 'video' ? 'video' : 'audio');
        el.preload = 'metadata';
        const dur = await new Promise<number>((res, rej) => {
          el.onloadedmetadata = () => res(el.duration);
          el.onerror = () => rej(new Error('not playable'));
          el.src = url;
        });
        rows.push(['Duration', formatDuration(dur)]);
        if (el instanceof HTMLVideoElement && el.videoWidth) rows.push(['Video size', `${el.videoWidth} × ${el.videoHeight} px`]);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (kind === 'zip') {
      if (file.size <= 512 * 1024 * 1024) {
        const { listZip } = await import('../../utils/zip');
        const entries = listZip(new Uint8Array(await file.arrayBuffer()));
        const files = entries.filter((e) => !e.isDirectory);
        rows.push(['Archive entries', `${files.length} files, ${entries.length - files.length} folders`]);
        rows.push(['Uncompressed size', formatBytes(files.reduce((a, e) => a + e.size, 0))]);
      }
    } else if ((kind === 'text' || kind === 'data') && file.size <= 50 * 1024 * 1024) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'UTF-8 with BOM' : bytes[0] === 0xff && bytes[1] === 0xfe ? 'UTF-16 LE (BOM)' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'UTF-16 BE (BOM)' : null;
      let utf8 = true;
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        utf8 = false;
      }
      rows.push(['Text encoding', bom ?? (utf8 ? 'UTF-8 (or ASCII)' : 'Not UTF-8 (legacy 8-bit encoding?)')]);
      const text = new TextDecoder().decode(bytes);
      rows.push(['Lines', (text.split(/\r\n|\r|\n/).length).toLocaleString()]);
      rows.push(['Line endings', text.includes('\r\n') ? 'Windows (CRLF)' : text.includes('\r') ? 'Classic Mac (CR)' : 'Unix (LF)']);
    }
  } catch (e) {
    rows.push(['Details', `Could not read: ${describeError(e).title}`]);
  }
  return rows;
}

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'stack', 'aria-live': 'polite' });
  root.append(dropzone({ accept: ['*'], multiple: true, onFiles: (f) => void inspectAll(f), paste: true, title: 'Drop any files to inspect' }), out);

  async function inspectAll(files: File[]) {
    render(out);
    for (const file of files.slice(0, 50)) {
      const card = h('section', { class: 'panel stack' }, h('h2', { class: 'panel-title break' }, file.name), h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Inspecting…'));
      out.append(card);
      const type = await detectFileType(file);
      const ext = extOf(file.name);
      const extra = await extraInfo(file, type.detected.kind);
      const hashCell = h('span', { class: 'hash-out' }, 'computing…');
      const prog = progress('Hashing…');
      const suggestions = suggestTools([file], 4);
      render(card,
        h('h2', { class: 'panel-title break' }, file.name),
        type.mismatch ? notice('warn', `The extension says “.${ext}”, but the content looks like a ${type.detected.label}. The file may be renamed or mislabelled.`) : null,
        kvTable([
          ['File name', h('span', { class: 'break' }, file.name)],
          ['Extension', ext ? `.${ext}` : '(none)'],
          ['MIME type (declared)', file.type || '(not provided by the system)'],
          ['Detected type', `${type.detected.label} · ${type.detected.mime}`],
          ['Size', `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`],
          ['Last modified', file.lastModified ? formatDate(file.lastModified) : '—'],
          ...extra,
          ['SHA-256', hashCell],
        ]),
        prog.el,
        suggestions.length ? h('p', { class: 'hint' }, 'Tools for this file: ', ...suggestions.flatMap((t, i) => [i ? ' · ' : '', h('a', { href: routeHref.tool(t.id) }, t.name)])) : null,
      );
      hashFile(file, ['SHA-256'], { signal: ctx.signal, onProgress: (f) => prog.set(f, 'Computing SHA-256…') })
        .then((d) => {
          const v = d['SHA-256'];
          hashCell.replaceChildren(v, ' ', button('', { variant: 'ghost', size: 'sm', icon: 'copy', ariaLabel: 'Copy SHA-256', onClick: () => void copyText(v) }));
        })
        .catch((e) => (hashCell.textContent = describeError(e).title))
        .finally(() => prog.hide());
    }
    if (files.length > 50) out.append(notice('info', `Only the first 50 of ${files.length} files are shown.`));
    ctx.recordUse();
  }
  if (ctx.initialFiles.length) void inspectAll(ctx.initialFiles);
};
