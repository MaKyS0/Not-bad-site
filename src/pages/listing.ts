import { h, render } from '../utils/dom';
import { toolGrid } from '../components/toolCard';
import { icon } from '../components/icons';
import { CATEGORIES, categoryById, toolsInCategory, TOOLS } from '../tools/catalog';
import { searchTools } from '../services/search';
import { routeHref } from '../services/router';
import { categoryChips } from './home';
import { plural, t } from '../i18n/i18n';
import { locCategory } from '../i18n/localize';

function breadcrumbs(items: [string, string | null][]): HTMLElement {
  return h(
    'nav',
    { class: 'breadcrumbs', 'aria-label': t('Breadcrumb') },
    h('ol', null, ...items.map(([label, link], i) => h('li', null, link ? h('a', { href: link }, label) : h('span', { 'aria-current': i === items.length - 1 ? 'page' : undefined }, label)))),
  );
}
export { breadcrumbs };

export function toolsPage(root: HTMLElement): void {
  const results = h('div', { 'aria-live': 'polite' });
  const filter = h('input', {
    type: 'search',
    class: 'input input-lg',
    placeholder: t('Filter tools…'),
    'aria-label': t('Filter tools'),
    autocomplete: 'off',
  });
  const draw = () => {
    const q = filter.value.trim();
    if (q) {
      const found = searchTools(q, 100);
      render(results, found.length ? toolGrid(found, { label: t('Matching tools') }) : h('p', { class: 'muted' }, t('No tools match “{q}”.', { q })));
      return;
    }
    render(
      results,
      ...CATEGORIES.map((c) =>
        h(
          'section',
          { class: 'category-block' },
          h('h2', { class: 'category-title' }, h('a', { href: routeHref.category(c.id) }, icon(c.icon), locCategory(c).name)),
          toolGrid(toolsInCategory(c.id), { label: locCategory(c).name }),
        ),
      ),
    );
  };
  filter.addEventListener('input', draw);
  render(
    root,
    breadcrumbs([[t('Home'), routeHref.home()], [t('All tools'), null]]),
    h('header', { class: 'page-head' }, h('h1', null, t('All tools')), h('p', { class: 'lead' }, t('{count} that run entirely in your browser.', { count: plural(TOOLS.length, 'tool') }))),
    categoryChips(),
    h('div', { class: 'filter-bar' }, icon('search'), filter),
    results,
  );
  draw();
}

export function categoryPage(root: HTMLElement, id: string): boolean {
  const raw = categoryById(id);
  if (!raw) return false;
  const cat = locCategory(raw);
  const main = toolsInCategory(id);
  const variants = toolsInCategory(id, true).filter((x) => x.variantOf);
  render(
    root,
    breadcrumbs([[t('Home'), routeHref.home()], [t('Tools'), routeHref.tools()], [cat.name, null]]),
    h('header', { class: 'page-head' }, h('span', { class: `tool-icon tool-icon-lg cat-${cat.id}` }, icon(cat.icon)), h('div', null, h('h1', null, t('{name} tools', { name: cat.name })), h('p', { class: 'lead' }, cat.description))),
    toolGrid(main, { label: cat.name }),
    variants.length ? h('section', { class: 'section' }, h('h2', null, t('Quick converters & presets')), toolGrid(variants, { label: t('Quick converters & presets') })) : null,
    h('section', { class: 'section' }, h('h2', null, t('Other categories')), categoryChips()),
  );
  return true;
}
