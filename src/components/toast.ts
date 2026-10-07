import { h } from '../utils/dom';
import { icon } from './icons';
import { leave, pop } from '../utils/motion';

type Kind = 'info' | 'success' | 'error';

function container(): HTMLElement {
  let el = document.getElementById('toasts');
  if (!el) {
    el = h('div', { id: 'toasts', class: 'toasts', role: 'region', 'aria-label': 'Notifications' });
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message: string, kind: Kind = 'info', ms = 3500): void {
  const el = h(
    'div',
    { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info'),
    h('span', null, message),
  );
  container().appendChild(el);
  pop(el, { y: 16, scale: 0.97 });
  setTimeout(() => {
    void leave(el, { y: 10 }).then(() => el.remove());
  }, ms);
}
