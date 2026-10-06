/**
 * History API router. Every route also exists as a static HTML file in the
 * build (generated for SEO), so deep links work on GitHub Pages without
 * redirect hacks; in-app navigation is intercepted for instant page changes.
 */
import { APP_BASE_PATH, href, routeOf } from '../utils/base';

export type Route =
  | { name: 'home' }
  | { name: 'tools' }
  | { name: 'category'; id: string }
  | { name: 'tool'; id: string }
  | { name: 'notFound'; path: string };

export function parseRoute(pathname: string): Route {
  const path = routeOf(pathname).replace(/index\.html$/, '').replace(/\/+$/, '');
  if (path === '' || path === '404.html') return path === '' ? { name: 'home' } : { name: 'notFound', path: pathname };
  const parts = path.split('/');
  if (parts[0] === 'tools' && parts.length === 1) return { name: 'tools' };
  if (parts[0] === 'tools' && parts.length === 2) return { name: 'tool', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'category' && parts.length === 2) return { name: 'category', id: decodeURIComponent(parts[1]) };
  return { name: 'notFound', path: pathname };
}

export const routeHref = {
  home: () => href(''),
  tools: () => href('tools/'),
  tool: (id: string) => href(`tools/${id}/`),
  category: (id: string) => href(`category/${id}/`),
};

type Handler = (route: Route, opts: { scroll: boolean }) => void;
let handler: Handler | null = null;

export function navigate(url: string, opts: { replace?: boolean } = {}): void {
  const target = new URL(url, location.href);
  if (target.origin !== location.origin || !target.pathname.startsWith(APP_BASE_PATH)) {
    location.href = target.href;
    return;
  }
  if (opts.replace) history.replaceState({}, '', target.href);
  else history.pushState({}, '', target.href);
  handler?.(parseRoute(target.pathname), { scroll: !target.hash });
}

export function startRouter(h: Handler): void {
  handler = h;
  window.addEventListener('popstate', () => handler?.(parseRoute(location.pathname), { scroll: false }));
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest?.('a');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.external !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(APP_BASE_PATH)) return;
    if (/\.(xml|txt|webmanifest|json|png|svg|ico)$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor
    e.preventDefault();
    navigate(url.href);
  });
  handler(parseRoute(location.pathname), { scroll: false });
}
