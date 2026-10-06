import { h } from '../utils/dom';
import { button } from './ui';
import { copyText, downloadBlob } from '../services/download';

export interface OutputPanel {
  el: HTMLElement;
  set(text: string): void;
  get(): string;
  setStatus(text: string, kind?: 'ok' | 'err' | ''): void;
}

/** Read-only result area with Copy and Download buttons. */
export function outputPanel(opts: { label: string; fileName: () => string; mime?: string; onUseAsInput?: (text: string) => void; rows?: number }): OutputPanel {
  const id = `out-${Math.random().toString(36).slice(2, 8)}`;
  const ta = h('textarea', { id, class: 'input', rows: opts.rows ?? 12, readonly: true, spellcheck: 'false' });
  const status = h('p', { class: 'status-line', 'aria-live': 'polite' });
  // Keep the exact string: <textarea> normalises CRLF to LF, which matters for CSV.
  let raw = '';
  const copyBtn = button('Copy', { variant: 'secondary', size: 'sm', icon: 'copy', onClick: () => void copyText(raw) });
  const dlBtn = button('Download', { variant: 'secondary', size: 'sm', icon: 'download', onClick: () => void downloadBlob(new Blob([raw], { type: opts.mime ?? 'text/plain;charset=utf-8' }), opts.fileName()) });
  const useBtn = opts.onUseAsInput ? button('Use as input', { variant: 'ghost', size: 'sm', icon: 'up', onClick: () => opts.onUseAsInput!(raw) }) : null;
  const sync = () => {
    const empty = !ta.value;
    copyBtn.disabled = empty;
    dlBtn.disabled = empty;
    if (useBtn) useBtn.disabled = empty;
  };
  sync();
  const el = h('div', { class: 'field' }, h('label', { for: id }, opts.label), h('div', { class: 'toolbar' }, copyBtn, dlBtn, useBtn), ta, status);
  return {
    el,
    set(text) {
      raw = text;
      ta.value = text;
      sync();
    },
    get: () => raw,
    setStatus(text, kind = '') {
      status.textContent = text;
      status.className = `status-line${kind ? ` status-${kind}` : ''}`;
    },
  };
}
