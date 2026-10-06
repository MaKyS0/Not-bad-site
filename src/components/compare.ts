import { h } from '../utils/dom';

/** Before/after slider. Keyboard accessible via the underlying range input. */
export function compareView(beforeUrl: string, afterUrl: string, labels: [string, string] = ['Before', 'After']): HTMLElement {
  const range = h('input', { type: 'range', min: '0', max: '100', value: '50', class: 'compare-range', 'aria-label': 'Before/after split position' });
  const el = h(
    'div',
    { class: 'compare' },
    h('img', { src: beforeUrl, alt: labels[0], draggable: 'false' }),
    h('div', { class: 'compare-after' }, h('img', { src: afterUrl, alt: labels[1], draggable: 'false' })),
    h('div', { class: 'compare-handle', 'aria-hidden': 'true' }),
    h('span', { class: 'compare-label left' }, labels[0]),
    h('span', { class: 'compare-label right' }, labels[1]),
    range,
  );
  range.addEventListener('input', () => el.style.setProperty('--pos', `${range.value}%`));
  return el;
}
