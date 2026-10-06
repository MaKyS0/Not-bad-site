import { h, render, uid } from '../utils/dom';
import { dialog, type DialogHandle } from './dialog';
import { searchTools } from '../services/search';
import { routeHref, navigate } from '../services/router';
import { icon } from './icons';
import { popularTools, categoryById } from '../tools/catalog';
import type { ToolMeta } from '../tools/types';

let instance: DialogHandle | null = null;
let inputEl: HTMLInputElement | null = null;

function resultItem(tool: ToolMeta, id: string, active: boolean): HTMLElement {
  return h(
    'li',
    { role: 'option', id, 'aria-selected': active ? 'true' : 'false', class: ['search-item', active && 'is-active'], dataset: { href: routeHref.tool(tool.id) } },
    h('span', { class: `tool-icon cat-${tool.category}` }, icon(tool.icon)),
    h('span', { class: 'search-item-text' }, h('strong', null, tool.name), h('small', null, tool.description)),
    h('span', { class: 'badge' }, categoryById(tool.category)?.name ?? ''),
  );
}

function create(): DialogHandle {
  const listId = uid('search-list');
  const input = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Search tools — try “webp”, “merge pdf”, “base64”…',
    'aria-label': 'Search tools',
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': listId,
    'aria-autocomplete': 'list',
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
  });
  inputEl = input;
  const list = h('ul', { id: listId, role: 'listbox', class: 'search-results', 'aria-label': 'Results' });
  const status = h('p', { class: 'search-status', 'aria-live': 'polite' });
  let results: ToolMeta[] = [];
  let active = 0;

  const update = () => {
    const q = input.value.trim();
    results = q ? searchTools(q, 12) : popularTools().slice(0, 8);
    active = 0;
    draw();
    status.textContent = q ? (results.length ? `${results.length} tools found` : `No tools match “${q}”.`) : 'Popular tools';
  };
  const draw = () => {
    render(list, ...results.map((t, i) => resultItem(t, `${listId}-${i}`, i === active)));
    input.setAttribute('aria-activedescendant', results.length ? `${listId}-${active}` : '');
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  };
  const go = (i: number) => {
    const t = results[i];
    if (!t) return;
    handle.close();
    navigate(routeHref.tool(t.id));
  };

  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(results.length - 1, active + 1);
      draw();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, active - 1);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active);
    }
  });
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (li) go(Array.from(list.children).indexOf(li));
  });

  const body = h('div', { class: 'search-body' }, h('div', { class: 'search-field' }, icon('search'), input), status, list);
  const handle = dialog('Search tools', body, { class: 'dialog-search', hideTitle: true });
  update();
  return handle;
}

export function openSearch(initial = ''): void {
  instance ??= create();
  instance.open();
  if (inputEl) {
    inputEl.value = initial;
    inputEl.dispatchEvent(new Event('input'));
    inputEl.focus();
    inputEl.select();
  }
}

export function initSearchShortcut(): void {
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      openSearch();
    }
  });
}
