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
import { locale, plural, t, translateMessage } from '../../i18n/i18n';
import { loc } from '../../i18n/localize';

async function extraInfo(file: File, kind: string): Promise<[string, string][]> {
  const rows: [string, string][] = [];
  try {
    if (kind === 'image') {
      const { decodeImage } = await import('../../services/imageService');
      const d = await decodeImage(file);
      rows.push([t('Dimensions'), `${d.width} × ${d.height} px`]);
      d.close();
    } else if (kind === 'pdf') {
      const { openPdfJs, readFileBytes } = await import('../pdf/lib');
      const doc = await openPdfJs(await readFileBytes(file));
      rows.push([t('Pages'), String(doc.numPages)]);
      void doc.loadingTask.destroy();
    } else if (kind === 'audio' || kind === 'video') {
      const url = URL.createObjectURL(file);
      try {
        const el = document.createElement(kind === 'video' ? 'video' : 'audio');
        el.preload = 'metadata';
        const dur = await new Promise<number>((res, rej) => {
          el.onloadedmetadata = () => res(el.duration);
          el.onerror = () => rej(new Error(t('not playable')));
          el.src = url;
        });
        rows.push([t('Duration'), formatDuration(dur)]);
        if (el instanceof HTMLVideoElement && el.videoWidth) rows.push([t('Video size'), `${el.videoWidth} × ${el.videoHeight} px`]);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (kind === 'zip') {
      if (file.size <= 512 * 1024 * 1024) {
        const { listZip } = await import('../../utils/zip');
        const entries = listZip(new Uint8Array(await file.arrayBuffer()));
        const files = entries.filter((e) => !e.isDirectory);
        rows.push([t('Archive entries'), `${plural(files.length, 'file')}, ${plural(entries.length - files.length, 'folder')}`]);
        rows.push([t('Uncompressed size'), formatBytes(files.reduce((a, e) => a + e.size, 0))]);
      }
    } else if ((kind === 'text' || kind === 'data') && file.size <= 50 * 1024 * 1024) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? t('UTF-8 with BOM') : bytes[0] === 0xff && bytes[1] === 0xfe ? t('UTF-16 LE (BOM)') : bytes[0] === 0xfe && bytes[1] === 0xff ? t('UTF-16 BE (BOM)') : null;
      let utf8 = true;
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        utf8 = false;
      }
      rows.push([t('Text encoding'), bom ?? (utf8 ? t('UTF-8 (or ASCII)') : t('Not UTF-8 (legacy 8-bit encoding?)'))]);
      const text = new TextDecoder().decode(bytes);
      rows.push([t('Lines'), (text.split(/\r\n|\r|\n/).length).toLocaleString(locale())]);
      rows.push([t('Line endings'), text.includes('\r\n') ? t('Windows (CRLF)') : text.includes('\r') ? t('Classic Mac (CR)') : t('Unix (LF)')]);
    }
  } catch (e) {
    rows.push([t('Details'), t('Could not read: {reason}', { reason: describeError(e).title })]);
  }
  return rows;
}

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'stack', 'aria-live': 'polite' });
  root.append(dropzone({ accept: ['*'], multiple: true, onFiles: (f) => void inspectAll(f), paste: true, title: t('Drop any files to inspect') }), out);

  let hashQueue: Promise<unknown> = Promise.resolve();
  async function inspectAll(files: File[]) {
    render(out);
    for (const file of files.slice(0, 50)) {
      const card = h('section', { class: 'panel stack' }, h('h2', { class: 'panel-title break' }, file.name), h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('Inspecting…')));
      out.append(card);
      const type = await detectFileType(file);
      const ext = extOf(file.name);
      const extra = await extraInfo(file, type.detected.kind);
      const hashCell = h('span', { class: 'hash-out' }, t('computing…'));
      const prog = progress(t('Hashing…'));
      const suggestions = suggestTools([file], 4);
      render(card,
        h('h2', { class: 'panel-title break' }, file.name),
        type.mismatch ? notice('warn', t('The extension says “.{ext}”, but the content looks like: {type}. The file may be renamed or mislabelled.', { ext, type: translateMessage(type.detected.label) })) : null,
        kvTable([
          [t('File name'), h('span', { class: 'break' }, file.name)],
          [t('Extension'), ext ? `.${ext}` : '(none)'],
          ['MIME type (declared)', file.type || t('(not provided by the system)')],
          [t('Detected type'), `${translateMessage(type.detected.label)} · ${type.detected.mime}`],
          [t('Size'), `${formatBytes(file.size)} (${plural(file.size, 'byte')})`],
          [t('Last modified'), file.lastModified ? formatDate(file.lastModified) : '—'],
          ...extra,
          ['SHA-256', hashCell],
        ]),
        prog.el,
        suggestions.length ? h('p', { class: 'hint' }, t('Tools for this file:'), ' ', ...suggestions.flatMap((tool, i) => [i ? ' · ' : '', h('a', { href: routeHref.tool(tool.id) }, loc(tool).name)])) : null,
      );
      // One file at a time: hashing holds the whole file in memory.
      hashQueue = hashQueue.then(() => hashFile(file, ['SHA-256'], { signal: ctx.signal, onProgress: (f) => prog.set(f, t('Computing SHA-256…')) }))
        .then((d) => {
          const v = d['SHA-256'];
          hashCell.replaceChildren(v, ' ', button('', { variant: 'ghost', size: 'sm', icon: 'copy', ariaLabel: t('Copy SHA-256'), onClick: () => void copyText(v) }));
        })
        .catch((e) => (hashCell.textContent = describeError(e).title))
        .finally(() => prog.hide());
    }
    if (files.length > 50) out.append(notice('info', t('Only the first 50 of {n} files are shown.', { n: files.length })));
    ctx.recordUse();
  }
  if (ctx.initialFiles.length) void inspectAll(ctx.initialFiles);
};
