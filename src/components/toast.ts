import { h } from '../utils/dom';
import { icon } from './icons';
import { pop, reducedMotion } from '../utils/motion';
import { animate } from 'motion/mini';

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
  pop(el, { y: 14, scale: 0.96 });
  setTimeout(() => {
    if (reducedMotion()) return el.remove();
    void animate(el, { opacity: [1, 0], transform: ['translateY(0)', 'translateY(10px)'] }, { duration: 0.2, ease: 'easeIn' }).then(() => el.remove());
  }, ms);
}
