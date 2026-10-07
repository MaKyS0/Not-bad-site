import { h, render } from '../utils/dom';
import { categoryLinks, directory, toolList } from '../components/toolCard';
import { icon } from '../components/icons';
import { categoryById, toolsInCategory, primaryTools, CATEGORIES } from '../tools/catalog';
import { searchTools } from '../services/search';
import { routeHref } from '../services/router';
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
    class: 'input',
    placeholder: t('Filter tools…'),
    'aria-label': t('Filter tools'),
    autocomplete: 'off',
  });
  const draw = () => {
    const q = filter.value.trim();
    if (q) {
      const found = searchTools(q, 100);
      render(
        results,
        found.length
          ? toolList(found, { label: t('Matching tools') })
          : h('div', { class: 'empty' }, h('p', null, t('No tools match “{q}”.', { q })), h('p', { class: 'muted' }, t('Try a file format (pdf, csv, webp) or an action (merge, compress, convert).'))),
      );
      return;
    }
    render(results, directory({ variants: true }));
  };
  filter.addEventListener('input', draw);
  render(
    root,
    breadcrumbs([[t('Home'), routeHref.home()], [t('All tools'), null]]),
    h('header', { class: 'page-head' }, h('h1', null, t('All tools')), h('p', { class: 'lead' }, t('{count} in {n} categories. Everything runs in your browser.', { count: plural(primaryTools().length, 'tool'), n: CATEGORIES.length }))),
    h('label', { class: 'filter-bar' }, icon('search'), filter),
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
    h('header', { class: `page-head cat-${cat.id}` }, h('h1', null, t('{name} tools', { name: cat.name })), h('p', { class: 'lead' }, cat.description)),
    toolList(main, { label: cat.name }),
    variants.length ? h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', null, t('Quick converters & presets'))), toolList(variants, { label: t('Quick converters & presets'), columns: true })) : null,
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', null, t('Other categories'))), categoryLinks(id)),
  );
  return true;
}
