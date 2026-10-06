import { h, render } from '../utils/dom';
import { toolGrid } from '../components/toolCard';
import { icon } from '../components/icons';
import { CATEGORIES, categoryById, toolsInCategory, TOOLS } from '../tools/catalog';
import { searchTools } from '../services/search';
import { routeHref } from '../services/router';
import { categoryChips } from './home';

function breadcrumbs(items: [string, string | null][]): HTMLElement {
  return h(
    'nav',
    { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
    h('ol', null, ...items.map(([label, link], i) => h('li', null, link ? h('a', { href: link }, label) : h('span', { 'aria-current': i === items.length - 1 ? 'page' : undefined }, label)))),
  );
}
export { breadcrumbs };

export function toolsPage(root: HTMLElement): void {
  const results = h('div', { 'aria-live': 'polite' });
  const filter = h('input', {
    type: 'search',
    class: 'input input-lg',
    placeholder: 'Filter tools…',
    'aria-label': 'Filter tools',
    autocomplete: 'off',
  });
  const draw = () => {
    const q = filter.value.trim();
    if (q) {
      const found = searchTools(q, 100);
      render(results, found.length ? toolGrid(found, { label: 'Matching tools' }) : h('p', { class: 'muted' }, `No tools match “${q}”.`));
      return;
    }
    render(
      results,
      ...CATEGORIES.map((c) =>
        h(
          'section',
          { class: 'category-block' },
          h('h2', { class: 'category-title' }, h('a', { href: routeHref.category(c.id) }, icon(c.icon), c.name)),
          toolGrid(toolsInCategory(c.id), { label: `${c.name} tools` }),
        ),
      ),
    );
  };
  filter.addEventListener('input', draw);
  render(
    root,
    breadcrumbs([['Home', routeHref.home()], ['All tools', null]]),
    h('header', { class: 'page-head' }, h('h1', null, 'All tools'), h('p', { class: 'lead' }, `${TOOLS.length} free tools that run entirely in your browser.`)),
    categoryChips(),
    h('div', { class: 'filter-bar' }, icon('search'), filter),
    results,
  );
  draw();
}

export function categoryPage(root: HTMLElement, id: string): boolean {
  const cat = categoryById(id);
  if (!cat) return false;
  const main = toolsInCategory(id);
  const variants = toolsInCategory(id, true).filter((t) => t.variantOf);
  render(
    root,
    breadcrumbs([['Home', routeHref.home()], ['Tools', routeHref.tools()], [cat.name, null]]),
    h('header', { class: 'page-head' }, h('span', { class: `tool-icon tool-icon-lg cat-${cat.id}` }, icon(cat.icon)), h('div', null, h('h1', null, `${cat.name} tools`), h('p', { class: 'lead' }, cat.description))),
    toolGrid(main, { label: `${cat.name} tools` }),
    variants.length ? h('section', { class: 'section' }, h('h2', null, 'Quick converters & presets'), toolGrid(variants, { label: 'Presets' })) : null,
    h('section', { class: 'section' }, h('h2', null, 'Other categories'), categoryChips()),
  );
  return true;
}
