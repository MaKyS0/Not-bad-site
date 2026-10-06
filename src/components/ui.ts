/**
 * Small reusable UI primitives. All of them produce accessible, labelled
 * controls with ≥44px touch targets (enforced in CSS).
 */
import { h, uid, type Child } from '../utils/dom';
import { icon } from './icons';
import { describeError, isAbort } from '../utils/errors';
import { t } from '../i18n/i18n';

export interface ButtonOpts {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export function button(label: Child, opts: ButtonOpts = {}): HTMLButtonElement {
  return h(
    'button',
    {
      type: opts.type ?? 'button',
      class: ['btn', `btn-${opts.variant ?? 'secondary'}`, opts.size && `btn-${opts.size}`, opts.class],
      onClick: opts.onClick,
      disabled: opts.disabled,
      title: opts.title,
      'aria-label': opts.ariaLabel,
    },
    opts.icon ? icon(opts.icon) : null,
    label !== '' && label !== null ? h('span', null, label) : null,
  );
}

export function iconButton(name: string, label: string, onClick?: (e: MouseEvent) => void, cls = ''): HTMLButtonElement {
  return h('button', { type: 'button', class: `icon-btn ${cls}`, 'aria-label': label, title: label, onClick }, icon(name));
}

/** Wrap a control with a visible label. */
export function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const id = control.id || uid('f');
  control.id = id;
  const hintId = hint ? `${id}-hint` : undefined;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('p', { class: 'hint', id: hintId }, hint) : null);
}

export function numberInput(value: number, opts: { min?: number; max?: number; step?: number; onInput?: (v: number) => void; ariaLabel?: string } = {}): HTMLInputElement {
  const el = h('input', {
    type: 'number',
    class: 'input',
    value: String(value),
    min: opts.min,
    max: opts.max,
    step: opts.step ?? 1,
    inputmode: 'decimal',
    'aria-label': opts.ariaLabel,
  });
  el.addEventListener('input', () => {
    const v = Number(el.value);
    if (Number.isFinite(v)) opts.onInput?.(v);
  });
  return el;
}

export function textInput(value: string, opts: { placeholder?: string; onInput?: (v: string) => void; ariaLabel?: string } = {}): HTMLInputElement {
  const el = h('input', { type: 'text', class: 'input', value, placeholder: opts.placeholder, 'aria-label': opts.ariaLabel, spellcheck: 'false', autocomplete: 'off' });
  el.addEventListener('input', () => opts.onInput?.(el.value));
  return el;
}

export function select<T extends string>(options: { value: T; label: string }[], value: T, onChange?: (v: T) => void): HTMLSelectElement {
  const el = h('select', { class: 'input' }, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  el.value = value;
  el.addEventListener('change', () => onChange?.(el.value as T));
  return el;
}

export function slider(
  label: string,
  value: number,
  opts: { min: number; max: number; step?: number; format?: (v: number) => string; onInput?: (v: number) => void },
): { el: HTMLElement; input: HTMLInputElement } {
  const id = uid('range');
  const out = h('output', { for: id, class: 'range-value' }, opts.format ? opts.format(value) : String(value));
  const input = h('input', { type: 'range', id, min: opts.min, max: opts.max, step: opts.step ?? 1, value: String(value), class: 'range' });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = opts.format ? opts.format(v) : String(v);
    opts.onInput?.(v);
  });
  const el = h('div', { class: 'field' }, h('div', { class: 'field-row' }, h('label', { for: id }, label), out), input);
  return { el, input };
}

export function checkbox(label: string, checked: boolean, onChange?: (v: boolean) => void): { el: HTMLElement; input: HTMLInputElement } {
  const input = h('input', { type: 'checkbox', checked, class: 'switch-input' });
  input.addEventListener('change', () => onChange?.(input.checked));
  const el = h('label', { class: 'check' }, input, h('span', { class: 'switch', 'aria-hidden': 'true' }), h('span', null, label));
  return { el, input };
}

/** Accessible segmented control (radio group). */
export function segmented<T extends string>(
  label: string,
  options: { value: T; label: string; icon?: string }[],
  value: T,
  onChange?: (v: T) => void,
): { el: HTMLElement; set: (v: T) => void } {
  const name = uid('seg');
  const inputs: HTMLInputElement[] = [];
  const group = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': label },
    ...options.map((o) => {
      const input = h('input', { type: 'radio', name, value: o.value, checked: o.value === value, class: 'sr-only' });
      input.addEventListener('change', () => input.checked && onChange?.(o.value));
      inputs.push(input);
      return h('label', { class: 'seg' }, input, o.icon ? icon(o.icon) : null, h('span', null, o.label));
    }),
  );
  const el = h('fieldset', { class: 'field fieldset' }, h('legend', null, label), group);
  return {
    el,
    set: (v: T) => inputs.forEach((i) => (i.checked = i.value === v)),
  };
}

export interface ProgressHandle {
  el: HTMLElement;
  set(fraction: number, label?: string): void;
  indeterminate(label?: string): void;
  hide(): void;
  show(): void;
}

/** Progress bar with text "Processing… ████░░ 82%". */
export function progress(initialLabel = t('Processing…')): ProgressHandle {
  const bar = h('div', { class: 'progress-fill' });
  const pct = h('span', { class: 'progress-pct' }, '0%');
  const text = h('span', { class: 'progress-label' }, initialLabel);
  const track = h('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': initialLabel }, bar);
  const el = h('div', { class: 'progress', hidden: true }, h('div', { class: 'progress-head' }, text, pct), track);
  return {
    el,
    set(f, label) {
      const p = Math.round(Math.max(0, Math.min(1, f)) * 100);
      el.hidden = false;
      el.classList.remove('is-indeterminate');
      bar.style.width = `${p}%`;
      pct.textContent = `${p}%`;
      track.setAttribute('aria-valuenow', String(p));
      if (label) {
        text.textContent = label;
        track.setAttribute('aria-label', label);
      }
    },
    indeterminate(label) {
      el.hidden = false;
      el.classList.add('is-indeterminate');
      pct.textContent = '';
      track.removeAttribute('aria-valuenow');
      if (label) text.textContent = label;
    },
    hide() {
      el.hidden = true;
    },
    show() {
      el.hidden = false;
    },
  };
}

export function notice(kind: 'info' | 'warn' | 'error' | 'success', ...children: Child[]): HTMLElement {
  const ic = kind === 'error' || kind === 'warn' ? 'alert' : kind === 'success' ? 'check' : 'info';
  return h('div', { class: `notice notice-${kind}`, role: kind === 'error' ? 'alert' : undefined }, icon(ic), h('div', null, ...children));
}

/** The standard error panel shown when an operation fails. */
export function errorPanel(e: unknown, onRetry?: () => void, retryLabel = t('Try another file')): HTMLElement {
  if (isAbort(e)) return h('div');
  const f = describeError(e);
  if (!(e instanceof Error && e.name === 'UserError')) console.error(e);
  return h(
    'div',
    { class: 'error-panel', role: 'alert' },
    icon('alert', 'icon icon-lg'),
    h('div', { class: 'error-body' },
      h('strong', null, f.title),
      f.message ? h('p', null, f.message) : null,
      f.details ? h('details', null, h('summary', null, t('Technical details')), h('code', null, f.details)) : null,
      onRetry ? button(retryLabel, { onClick: onRetry, variant: 'secondary' }) : null,
    ),
  );
}

export function statGrid(items: [string, Child][]): HTMLElement {
  return h('dl', { class: 'stats' }, ...items.map(([k, v]) => h('div', { class: 'stat' }, h('dt', null, k), h('dd', null, v))));
}

export function kvTable(rows: [string, Child][], caption?: string): HTMLElement {
  return h(
    'div',
    { class: 'table-wrap' },
    h('table', { class: 'kv' }, caption ? h('caption', null, caption) : null, h('tbody', null, ...rows.map(([k, v]) => h('tr', null, h('th', { scope: 'row' }, k), h('td', null, v))))),
  );
}

export function card(...children: Child[]): HTMLElement {
  return h('section', { class: 'panel' }, ...children);
}

export function toolbar(...children: Child[]): HTMLElement {
  return h('div', { class: 'toolbar' }, ...children);
}
