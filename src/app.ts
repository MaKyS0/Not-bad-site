import { h, render } from './utils/dom';
import { startRouter, type Route, routeHref, langOf } from './services/router';
import { homePage } from './pages/home';
import { toolsPage, categoryPage } from './pages/listing';
import { toolPage } from './pages/tool';
import { getTool } from './tools/registry';
import { categoryById } from './tools/catalog';
import { toolTitle, toolDescription } from './seo/content';
import { APP_NAME, TAGLINE, SUBTITLE } from './config';
import { openSearch } from './components/searchDialog';
import { openSettings } from './components/settingsDialog';
import { getLang, LANG_PREF_KEY, setLang, t, type Lang } from './i18n/i18n';
import { locCategory } from './i18n/localize';

let cleanup: (() => void) | null = null;

function setMeta(title: string, description: string): void {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
}

/** Keep the EN/RU switcher pointing at the current page after SPA navigation. */
function syncLangLinks(): void {
  document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]').forEach((a) => {
    a.href = routeHref.inLang(a.dataset.langLink as Lang);
  });
}

function notFound(main: HTMLElement): void {
  setMeta(`${t('Page not found')} | ${APP_NAME}`, t('The page you are looking for does not exist.'));
  render(
    main,
    h(
      'section',
      { class: 'not-found' },
      h('h1', null, t('Page not found')),
      h('p', { class: 'lead' }, t('The page you are looking for does not exist or was moved.')),
      h('div', { class: 'toolbar' }, h('a', { class: 'btn btn-primary', href: routeHref.home() }, t('Go to home page')), h('a', { class: 'btn btn-secondary', href: routeHref.tools() }, t('Browse all tools'))),
    ),
  );
}

function show(route: Route, opts: { scroll: boolean }): void {
  const main = document.getElementById('main')!;
  if (cleanup) {
    try {
      cleanup();
    } catch (e) {
      console.error(e);
    }
    cleanup = null;
  }
  document.documentElement.lang = getLang();
  syncLangLinks();
  closeMenu();
  markNav(route);
  try {
    switch (route.name) {
      case 'home':
        setMeta(`${APP_NAME} — ${t(TAGLINE)}`, t(SUBTITLE));
        cleanup = homePage(main);
        break;
      case 'tools':
        setMeta(`${t('All Tools')} | ${APP_NAME}`, t('Every free, private, in-browser file tool: images, PDF, data, text, ZIP, audio and developer utilities.'));
        toolsPage(main);
        break;
      case 'category': {
        const cat = categoryById(route.id);
        if (!cat || !categoryPage(main, route.id)) return notFound(main);
        const lc = locCategory(cat);
        setMeta(`${t('{name} Tools — Free & Private', { name: lc.name })} | ${APP_NAME}`, lc.description);
        break;
      }
      case 'tool': {
        const tool = getTool(route.id);
        if (!tool) return notFound(main);
        setMeta(toolTitle(tool), toolDescription(tool));
        cleanup = toolPage(main, route.id);
        break;
      }
      default:
        notFound(main);
    }
  } catch (e) {
    console.error(e);
    render(main, h('div', { class: 'error-panel', role: 'alert' }, h('strong', null, t('Something went wrong while loading this page.')), h('p', null, t('Please reload the page.'))));
  }
  if (opts.scroll) window.scrollTo({ top: 0 });
  // Move focus to the main heading for screen reader users after navigation.
  const h1 = main.querySelector('h1');
  if (h1 && opts.scroll) {
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }
}

/** Highlight where the user is: the page itself, or its category for a tool page. */
function markNav(route: Route): void {
  document.querySelectorAll('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));
  const set = (key: string, value: 'page' | 'true') => document.querySelectorAll(`[data-nav="${key}"]`).forEach((a) => a.setAttribute('aria-current', value));
  if (route.name === 'tools') set('tools', 'page');
  else if (route.name === 'category') set(`category/${route.id}`, 'page');
  else if (route.name === 'tool') {
    const cat = getTool(route.id)?.category;
    if (cat) set(`category/${cat}`, 'true');
  }
  // Categories without a header link fall back to "All tools".
  const nav = document.querySelector('.header-nav');
  if (nav && route.name !== 'home' && route.name !== 'notFound' && !nav.querySelector('[aria-current]')) nav.querySelector('[data-nav="tools"]')?.setAttribute('aria-current', 'true');
}

function closeMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-action="menu"]');
  const panel = document.getElementById('mobile-nav');
  if (!btn || !panel || panel.hidden) return;
  panel.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

function initMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-action="menu"]');
  const panel = document.getElementById('mobile-nav');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector<HTMLElement>('a')?.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      closeMenu();
      btn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    if (!panel.hidden && !panel.contains(target) && !btn.contains(target)) closeMenu();
  });
}

/**
 * On the very first visit, switch to Russian if the browser prefers it.
 * An explicit choice (clicking EN/RU) is remembered and always wins.
 * Returns true when a redirect was started.
 */
function autoLanguage(): boolean {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANG_PREF_KEY);
  } catch {
    return false;
  }
  const prefersRu = (navigator.languages ?? [navigator.language]).some((l) => /^(ru|be|uk|kk)\b/i.test(l ?? ''));
  const want: Lang | null = saved === 'en' || saved === 'ru' ? saved : prefersRu ? 'ru' : null;
  if (want && want !== getLang() && !saved) {
    try {
      localStorage.setItem(LANG_PREF_KEY, want);
    } catch {
      /* ignore */
    }
    location.replace(routeHref.inLang(want) + location.search + location.hash);
    return true;
  }
  return false;
}

export function startApp(): void {
  setLang(langOf(location.pathname));
  if (autoLanguage()) return;
  document.querySelector('[data-action="search"]')?.addEventListener('click', () => openSearch());
  document.querySelector('[data-action="settings"]')?.addEventListener('click', () => openSettings());
  initMenu();
  // Remember an explicit language choice.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.<HTMLAnchorElement>('a[data-lang-link]');
    if (!a) return;
    try {
      localStorage.setItem(LANG_PREF_KEY, a.dataset.langLink!);
    } catch {
      /* ignore */
    }
  });
  document.documentElement.classList.add('js');
  // Header shadow once the page is scrolled.
  const header = document.querySelector('.site-header');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  startRouter(show);
}
