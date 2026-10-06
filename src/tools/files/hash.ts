import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { checkbox, textInput, field, progress, notice, button } from '../../components/ui';
import { hashFile } from '../../services/hashService';
import { describeError } from '../../utils/errors';
import { formatBytes } from '../../utils/format';
import { copyText, downloadBlob } from '../../services/download';
import { icon } from '../../components/icons';

const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ algos: 'SHA-256' });
  const selected = new Set(s.algos.split(',').filter((a) => ALGOS.includes(a)));
  if (!selected.size) selected.add('SHA-256');
  let expected = '';
  const results: { file: File; digests: Record<string, string> }[] = [];
  const list = h('ul', { class: 'file-list', 'aria-live': 'polite' });
  const prog = progress('Hashing…');
  const exportBtn = button('Download checksums (.sha256 style)', { variant: 'secondary', icon: 'download', onClick: () => {
    const lines = results.flatMap((r) => Object.entries(r.digests).map(([a, d]) => `${d}  ${r.file.name}${selected.size > 1 ? `  (${a})` : ''}`));
    void downloadBlob(new Blob([`${lines.join('\n')}\n`], { type: 'text/plain' }), 'checksums.txt');
  } });
  exportBtn.hidden = true;

  const algoBoxes = h('div', { class: 'toolbar', role: 'group', 'aria-label': 'Algorithms' }, ...ALGOS.map((a) => checkbox(a, selected.has(a), (v) => {
    if (v) selected.add(a);
    else selected.delete(a);
    s.algos = [...selected].join(',');
    ctx.saveSettings(s);
  }).el));
  const expectedIn = textInput('', { placeholder: 'Paste the expected hash to compare (optional)', onInput: (v) => { expected = v.trim().toLowerCase(); drawAll(); } });

  const rowFor = (r: { file: File; digests: Record<string, string> }) => {
    const match = expected && Object.values(r.digests).some((d) => d === expected);
    return h('li', { class: 'file-row' },
      h('div', { class: 'file-thumb' }, icon('hash')),
      h('div', { class: 'file-info' },
        h('span', { class: 'file-name' }, r.file.name),
        h('span', { class: 'file-meta' }, formatBytes(r.file.size), expected ? h('span', { class: match ? 'match-ok' : 'match-bad' }, match ? '✓ matches expected hash' : '✗ does not match') : null),
        ...Object.entries(r.digests).map(([a, d]) => h('div', { class: 'hash-out' }, h('strong', null, `${a}: `), d, ' ', button('', { variant: 'ghost', size: 'sm', icon: 'copy', ariaLabel: `Copy ${a}`, onClick: () => void copyText(d) }))),
      ),
    );
  };
  const drawAll = () => render(list, ...results.map(rowFor));

  async function run(files: File[]) {
    if (!selected.size) {
      render(list, notice('error', 'Select at least one algorithm.'));
      return;
    }
    for (const [i, file] of files.entries()) {
      try {
        const digests = await hashFile(file, [...selected], { signal: ctx.signal, onProgress: (f) => prog.set(f, `Hashing ${file.name} (${i + 1}/${files.length})…`) });
        results.push({ file, digests });
        drawAll();
      } catch (e) {
        const f = describeError(e);
        list.append(h('li', { class: 'file-row is-error' }, h('div', { class: 'file-thumb' }, icon('alert')), h('div', { class: 'file-info' }, h('span', { class: 'file-name' }, file.name), h('span', { class: 'status-err' }, `${f.title} ${f.message}`))));
      }
    }
    prog.hide();
    exportBtn.hidden = !results.length;
    if (results.length) ctx.recordUse(s);
  }

  root.append(
    h('div', { class: 'panel stack' }, algoBoxes, field('Expected hash', expectedIn)),
    dropzone({ accept: ['*'], multiple: true, onFiles: (f) => void run(f), title: 'Drop files to hash', compact: true }),
    prog.el,
    list,
    exportBtn,
    h('p', { class: 'hint' }, 'Files up to 512 MB are hashed with the Web Crypto API; larger files are streamed through SHA-256 so memory stays low.'),
  );
  if (ctx.initialFiles.length) void run(ctx.initialFiles);
};
