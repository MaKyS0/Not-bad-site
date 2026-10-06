import { h } from '../utils/dom';
import { icon } from './icons';
import { routeHref } from '../services/router';
import type { ToolMeta } from '../tools/types';

export function toolCard(tool: ToolMeta, opts: { onClick?: (e: MouseEvent) => void; meta?: string } = {}): HTMLElement {
  return h(
    'a',
    { class: 'tool-card', href: routeHref.tool(tool.id), onClick: opts.onClick },
    h('span', { class: `tool-icon cat-${tool.category}` }, icon(tool.icon)),
    h('span', { class: 'tool-card-body' }, h('strong', { class: 'tool-card-title' }, tool.name), h('span', { class: 'tool-card-desc' }, tool.description)),
    opts.meta ? h('span', { class: 'tool-card-meta' }, opts.meta) : null,
  );
}

export function toolGrid(tools: ToolMeta[], opts: { onClick?: (tool: ToolMeta, e: MouseEvent) => void; label?: string } = {}): HTMLElement {
  return h(
    'ul',
    { class: 'tool-grid', role: 'list', 'aria-label': opts.label },
    ...tools.map((t) => h('li', null, toolCard(t, { onClick: opts.onClick ? (e) => opts.onClick!(t, e) : undefined }))),
  );
}
