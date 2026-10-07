import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, notice, errorPanel, kvTable, imgFor } from '../../components/ui';
import { bytesToBase64 } from '../text/lib/codec';
import { copyText } from '../../services/download';
import { formatBytes } from '../../utils/format';
import { detectFileType } from '../../utils/fileType';
import { plural, t } from '../../i18n/i18n';

const MAX = 10 * 1024 * 1024;

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'stack', 'aria-live': 'polite' });
  const zone = dropzone({ accept: ['*'], multiple: false, onFiles: (f) => void make(f[0]), paste: true, title: t('Drop a file (image, font, SVG…)') });
  root.append(zone, out);

  async function make(file: File) {
    try {
      if (file.size > MAX) throw new Error(t('File is {size}. Data URIs larger than {max} are impractical — host the file instead.', { size: formatBytes(file.size), max: formatBytes(MAX) }));
      const type = await detectFileType(file);
      const mime = file.type || type.detected.mime;
      const uri = `data:${mime};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`;
      const isImg = mime.startsWith('image/');
      const snippets: [string, string][] = [
        [t('Data URI'), uri],
        ...(isImg ? ([
          ['HTML <img>', `<img src="${uri}" alt="">`],
          [t('CSS background'), `background-image: url("${uri}");`],
          [t('Markdown'), `![image](${uri})`],
        ] as [string, string][]) : []),
      ];
      const preview = isImg ? h('div', { class: 'preview-box', style: 'min-height:120px' }, imgFor(ctx, file, { alt: t('Preview'), style: 'max-height:200px' })) : null;
      render(
        out,
        kvTable([[t('File'), file.name], ['MIME type', mime], [t('File size'), formatBytes(file.size)], [t('Data URI length'), `${plural(uri.length, 'character')} (${formatBytes(uri.length)})`]]),
        file.size > 100 * 1024 ? notice('warn', t('Data URIs are ~33 % larger than the file and cannot be cached separately. They are best for small icons (< 10 KB).')) : null,
        preview,
        ...snippets.map(([label, code]) =>
          h('div', { class: 'field' },
            h('div', { class: 'toolbar', style: 'justify-content:space-between' }, h('span', { class: 'field-label' }, label), button(t('Copy'), { size: 'sm', icon: 'copy', onClick: () => void copyText(code) })),
            h('pre', { class: 'code-view wrap', style: 'max-height:160px' }, code.length > 20000 ? `${code.slice(0, 20000)}… ${t('({n} chars — use Copy)', { n: code.length.toLocaleString() })}` : code),
          ),
        ),
      );
      ctx.recordUse();
    } catch (e) {
      render(out, errorPanel(e));
    }
  }
  if (ctx.initialFiles[0]) void make(ctx.initialFiles[0]);
};
