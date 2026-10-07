/**
 * Virus check: local static analysis for malware red flags (see lib/scan.ts)
 * plus an optional, user-initiated VirusTotal lookup of the SHA-256 hash.
 * The file itself never leaves the device.
 */
import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { icon } from '../../components/icons';
import { button, kvTable, notice, progress } from '../../components/ui';
import { formatBytes, stripBidi } from '../../utils/format';
import { hashFile } from '../../services/hashService';
import { copyText } from '../../services/download';
import { describeError } from '../../utils/errors';
import { WorkerPool } from '../../workers/rpc';
import { plural, t, translateMessage } from '../../i18n/i18n';
import { RULES, verdict, type Finding, type ScanReport } from './lib/scan';
import { enter, pop } from '../../utils/motion';

let pool: WorkerPool | null = null;
const scanWorker = () => (pool ??= new WorkerPool(() => new Worker(new URL('../../workers/scan.worker.ts', import.meta.url), { type: 'module' }), 1));

const MAX_FILES = 100;

function localParams(f: Finding): Record<string, string | number> {
  const p = { ...f.params };
  if (typeof p.type === 'string') p.type = translateMessage(p.type);
  if (typeof p.count === 'number') p.count = plural(p.count, 'file');
  return p;
}

function findingItem(f: Finding): HTMLElement {
  const rule = RULES[f.id];
  const params = localParams(f);
  const label = f.severity === 'danger' ? t('Danger') : f.severity === 'warn' ? t('Caution') : t('Note');
  return h(
    'li',
    { class: `finding finding-${f.severity}` },
    h('span', { class: 'finding-icon', 'aria-hidden': 'true' }, icon(f.severity === 'info' ? 'info' : 'alert')),
    h(
      'div',
      null,
      h('strong', null, h('span', { class: 'sr-only' }, `${label}: `), t(rule.title, params)),
      h('p', { dir: 'auto' }, t(rule.detail, params)),
      // Findings inside an archive name the entry when the text itself doesn't.
      params.name && !`${rule.title}${rule.detail}`.includes('{name}') ? h('p', { class: 'finding-where', dir: 'auto' }, t('Inside the archive: {name}', { name: params.name })) : null,
    ),
  );
}

function verdictBanner(report: ScanReport): HTMLElement {
  const v = verdict(report.findings);
  const [title, text] =
    v === 'danger'
      ? [t('Dangerous signs found'), t('Do not open this file unless you are sure it is safe. Delete it if you did not expect it.')]
      : v === 'warn'
        ? [t('Be careful with this file'), t('Nothing clearly malicious was found, but the file can run code or hides something that could not be checked.')]
        : [t('No threats found'), t('No known malware tricks were detected by the local checks. This is not a guarantee — see the VirusTotal check below for a second opinion.')];
  return h('div', { class: `verdict verdict-${v}`, role: v === 'clean' ? 'status' : 'alert' }, icon(v === 'clean' ? 'shield' : 'alert', 'icon icon-lg'), h('div', null, h('strong', null, title), h('p', null, text)));
}

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'stack', 'aria-live': 'polite' });
  root.append(
    notice(
      'info',
      h('strong', null, t('How this check works')),
      h('p', null, t('Files are analysed on your device and are never uploaded. The scanner looks for the tricks malware uses — programs disguised as documents, Office macros, PDF scripts, dropper commands, zip bombs and more. It is not a replacement for an antivirus program: it has no database of known viruses.')),
    ),
    dropzone({ accept: ['*'], multiple: true, onFiles: (f) => void scanAll(f), paste: true, title: t('Drop files to check for viruses'), folders: true }),
    out,
  );

  let run = 0;
  let hashQueue: Promise<unknown> = Promise.resolve();
  async function scanAll(files: File[]) {
    const id = ++run;
    render(out);
    const summary = h('div');
    out.append(summary);
    const counts = { danger: 0, warn: 0, clean: 0, failed: 0 };
    for (const file of files.slice(0, MAX_FILES)) {
      if (id !== run || ctx.signal.aborted) return;
      const card = h('section', { class: 'panel stack' }, h('h2', { class: 'panel-title break', dir: 'auto' }, stripBidi(file.name)));
      const prog = progress(t('Scanning…'));
      card.append(prog.el);
      out.append(card);
      const hashCell = h('span', { class: 'hash-out' }, t('computing…'));
      const vtSlot = h('div');
      // Hash one file at a time: hashing holds the whole file in memory.
      const digest = hashQueue.catch(() => {}).then(() => hashFile(file, ['SHA-256'], { signal: ctx.signal }));
      hashQueue = digest;
      const hashing = digest.then((d) => {
        const sha = d['SHA-256'];
        hashCell.replaceChildren(sha, ' ', button('', { variant: 'ghost', size: 'sm', icon: 'copy', ariaLabel: t('Copy SHA-256'), onClick: () => void copyText(sha) }));
        render(
          vtSlot,
          h(
            'div',
            { class: 'vt-row' },
            h('a', { class: 'btn btn-secondary', href: `https://www.virustotal.com/gui/file/${sha}`, target: '_blank', rel: 'noopener noreferrer' }, icon('search'), h('span', null, t('Check hash on VirusTotal'))),
            h('p', { class: 'hint' }, t('Opens VirusTotal in a new tab with only the SHA-256 checksum — the file itself is not sent. If anyone has scanned the same file before, you will see the verdicts of 70+ antivirus engines.')),
          ),
        );
      });
      hashing.catch((e) => (hashCell.textContent = describeError(e).title));
      try {
        const report = await scanWorker().call<ScanReport>('scan', { file }, { signal: ctx.signal, onProgress: (f) => prog.set(f, t('Scanning…')) });
        prog.hide();
        const v = verdict(report.findings);
        counts[v]++;
        const banner = verdictBanner(report);
        card.append(banner);
        pop(banner);
        if (report.findings.length) {
          const findings = h('ul', { class: 'findings' }, ...report.findings.map(findingItem));
          card.append(findings);
          enter(findings.children, { delay: 0.12, gap: 0.07 });
        }
        card.append(
          kvTable([
            [t('Detected type'), translateMessage(report.detected)],
            [t('Size'), formatBytes(file.size)],
            [t('Checked'), report.complete ? t('Entire file') : t('First {size}', { size: formatBytes(report.scanned) })],
            ['SHA-256', hashCell],
          ]),
          vtSlot,
        );
      } catch (e) {
        prog.hide();
        if (ctx.signal.aborted) return;
        counts.failed++;
        card.append(notice('error', t('Could not check this file: {reason}', { reason: describeError(e).title })));
      }
    }
    if (files.length > MAX_FILES) out.append(notice('info', t('Only the first {n} files were checked.', { n: MAX_FILES })));
    if (files.length > 1) {
      render(
        summary,
        notice(
          counts.danger ? 'error' : counts.warn ? 'warn' : 'success',
          t('Checked {files}: {danger} dangerous, {warn} need caution, {clean} without threats.', {
            files: plural(Math.min(files.length, MAX_FILES), 'file'),
            danger: counts.danger,
            warn: counts.warn,
            clean: counts.clean,
          }),
        ),
      );
    }
    ctx.recordUse();
  }
  if (ctx.initialFiles.length) void scanAll(ctx.initialFiles);
  ctx.onCleanup(() => pool?.terminate());
};
