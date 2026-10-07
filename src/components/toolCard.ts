/**
 * Components for listing tools. Different pages need different density:
 * - toolList: rows with a purpose line and format tags (category pages, search, suggestions);
 * - directory: an index of every tool by category (home, all tools).
 */
import { h } from '../utils/dom';
import { icon } from './icons';
import { routeHref } from '../services/router';
import type { ToolMeta } from '../tools/types';
import { CATEGORIES, toolsInCategory } from '../tools/catalog';
import { conversionLabel, formatTags } from '../tools/formats';
import { loc, locCategory } from '../i18n/localize';

export const fmtTags = (tool: ToolMeta): HTMLElement =>
  h('span', { class: 'fmts', 'aria-hidden': 'true' }, ...formatTags(tool).map((f) => h('span', { class: 'fmt' }, f)));

export function toolRow(tool: ToolMeta, opts: { onClick?: (e: MouseEvent) => void } = {}): HTMLElement {
  const l = loc(tool);
  return h(
    'a',
    { class: 'tool-row', href: routeHref.tool(tool.id), onClick: opts.onClick },
    h('span', { class: `tool-icon cat-${tool.category}` }, icon(tool.icon)),
    h('span', { class: 'tool-row-body' }, h('span', { class: 'tool-row-name' }, l.name), h('span', { class: 'tool-row-desc' }, l.description)),
    fmtTags(tool),
  );
}

export function toolList(tools: ToolMeta[], opts: { onClick?: (tool: ToolMeta, e: MouseEvent) => void; label?: string; columns?: boolean } = {}): HTMLElement {
  return h(
    'ul',
    { class: ['tool-list', opts.columns && 'tool-list-2'], role: 'list', 'aria-label': opts.label },
    ...tools.map((t) => h('li', null, toolRow(t, { onClick: opts.onClick ? (e) => opts.onClick!(t, e) : undefined }))),
  );
}

/**
 * Every tool, grouped by category. On narrow screens each category becomes a
 * disclosure so the page isn't a 40-item scroll. `variants` adds the quick
 * converters (e.g. JPG → WebP) as small format links.
 */
export function directory(opts: { variants?: boolean } = {}): HTMLElement {
  const compact = matchMedia('(max-width: 640px)').matches;
  return h(
    'div',
    { class: ['dir', compact && 'dir-compact'] },
    ...CATEGORIES.map((c) => {
      const lc = locCategory(c);
      const tools = toolsInCategory(c.id);
      const variants = opts.variants ? toolsInCategory(c.id, true).filter((x) => x.variantOf) : [];
      const list = h(
        'ul',
        { role: 'list' },
        ...tools.map((t) => h('li', null, h('a', { href: routeHref.tool(t.id) }, h('span', { class: 'dir-name' }, loc(t).name)))),
      );
      // Converters read best as "JPG → PNG" tags, other presets by name.
      const extra = variants.length
        ? h('div', { class: 'dir-variants' }, ...variants.map((v) => {
            const conv = conversionLabel(v);
            return conv ? h('a', { class: 'fmt', href: routeHref.tool(v.id), title: loc(v).name }, conv) : h('a', { class: 'dir-variant', href: routeHref.tool(v.id) }, loc(v).name);
          }))
        : null;
      const count = h('span', { class: 'dir-count' }, String(tools.length));
      if (compact) {
        return h('details', { class: `dir-group cat-${c.id}` }, h('summary', null, h('span', { class: 'cat-dot' }), lc.name, count), list, extra);
      }
      return h(
        'section',
        { class: `dir-group cat-${c.id}` },
        h('h3', { class: 'dir-head' }, h('span', { class: 'cat-dot' }), h('a', { href: routeHref.category(c.id) }, lc.name), count),
        list,
        extra,
      );
    }),
  );
}

export function categoryLinks(exclude?: string): HTMLElement {
  return h(
    'ul',
    { class: 'category-chips', role: 'list' },
    ...CATEGORIES.filter((c) => c.id !== exclude).map((c) => h('li', null, h('a', { class: `category-chip cat-${c.id}`, href: routeHref.category(c.id) }, h('span', { class: 'cat-dot' }), locCategory(c).name))),
  );
}
