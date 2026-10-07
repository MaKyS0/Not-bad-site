import { h, type Child } from '../utils/dom';
import { iconButton } from './ui';
import { t } from '../i18n/i18n';
import { pop } from '../utils/motion';

export interface DialogHandle {
  el: HTMLDialogElement;
  open(): void;
  close(): void;
}

/** Modal built on the native <dialog> element (focus trapping, Esc to close, inert background). */
export function dialog(title: string, body: Child, opts: { class?: string; onClose?: () => void; hideTitle?: boolean } = {}): DialogHandle {
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const el = h(
    'dialog',
    { class: ['dialog', opts.class], 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'dialog-inner' },
      h('div', { class: ['dialog-head', opts.hideTitle && 'sr-only'] }, h('h2', { id: titleId }, title), iconButton('x', t('Close'), () => handle.close())),
      body,
    ),
  );
  // Click on the backdrop closes the dialog.
  el.addEventListener('click', (e) => {
    if (e.target === el) handle.close();
  });
  el.addEventListener('close', () => opts.onClose?.());
  document.body.appendChild(el);
  let returnFocus: HTMLElement | null = null;
  const handle: DialogHandle = {
    el,
    open() {
      returnFocus = document.activeElement as HTMLElement | null;
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      pop(el, { scale: 0.98, y: 8 });
    },
    close() {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
      returnFocus?.focus?.();
    },
  };
  return handle;
}
