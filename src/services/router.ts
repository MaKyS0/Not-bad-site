/**
 * History API router. Every route also exists as a static HTML file in the
 * build (generated for SEO), so deep links work on GitHub Pages without
 * redirect hacks; in-app navigation is intercepted for instant page changes.
 */
import { APP_BASE_PATH, href, routeOf } from '../utils/base';
import { langPrefix, setLang, type Lang } from '../i18n/i18n';

export type Route =
  | { name: 'home' }
  | { name: 'tools' }
  | { name: 'category'; id: string }
  | { name: 'tool'; id: string }
  | { name: 'notFound'; path: string };

/** Language encoded in a pathname (/ru/… → ru). */
export function langOf(pathname: string): Lang {
  return /^ru(\/|$)/.test(routeOf(pathname)) ? 'ru' : 'en';
}

/** Route path without base and language prefix, e.g. "tools/zip/". */
export function routePathOf(pathname: string): string {
  return routeOf(pathname).replace(/^ru(\/|$)/, '').replace(/index\.html$/, '');
}

export function parseRoute(pathname: string): Route {
  setLang(langOf(pathname));
  const path = routePathOf(pathname).replace(/\/+$/, '');
  if (path === '' || path === '404.html') return path === '' ? { name: 'home' } : { name: 'notFound', path: pathname };
  const parts = path.split('/');
  if (parts[0] === 'tools' && parts.length === 1) return { name: 'tools' };
  if (parts[0] === 'tools' && parts.length === 2) return { name: 'tool', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'category' && parts.length === 2) return { name: 'category', id: decodeURIComponent(parts[1]) };
  return { name: 'notFound', path: pathname };
}

export const routeHref = {
  home: () => href(langPrefix()),
  tools: () => href(`${langPrefix()}tools/`),
  tool: (id: string) => href(`${langPrefix()}tools/${id}/`),
  category: (id: string) => href(`${langPrefix()}category/${id}/`),
  /** The current page in another language. */
  inLang: (lang: Lang) => href(langPrefix(lang) + routePathOf(location.pathname)),
};

type Handler = (route: Route, opts: { scroll: boolean }) => void;
let handler: Handler | null = null;

export function navigate(url: string, opts: { replace?: boolean } = {}): void {
  const target = new URL(url, location.href);
  // Another language means another static shell (header/footer): do a full load.
  if (target.origin !== location.origin || !target.pathname.startsWith(APP_BASE_PATH) || langOf(target.pathname) !== langOf(location.pathname)) {
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
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.external !== undefined || a.dataset.langLink) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(APP_BASE_PATH)) return;
    if (/\.(xml|txt|webmanifest|json|png|svg|ico)$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor
    e.preventDefault();
    navigate(url.href);
  });
  handler(parseRoute(location.pathname), { scroll: false });
}
