import { h, render } from './utils/dom';
import { startRouter, type Route, routeHref } from './services/router';
import { homePage } from './pages/home';
import { toolsPage, categoryPage } from './pages/listing';
import { toolPage } from './pages/tool';
import { getTool } from './tools/registry';
import { categoryById } from './tools/catalog';
import { toolTitle, toolDescription } from './seo/content';
import { APP_NAME, TAGLINE, SUBTITLE } from './config';
import { openSearch } from './components/searchDialog';
import { openSettings } from './components/settingsDialog';

let cleanup: (() => void) | null = null;

function setMeta(title: string, description: string): void {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
}

function notFound(main: HTMLElement): void {
  setMeta(`Page not found | ${APP_NAME}`, 'The page you are looking for does not exist.');
  render(
    main,
    h(
      'section',
      { class: 'not-found' },
      h('h1', null, 'Page not found'),
      h('p', { class: 'lead' }, 'The page you are looking for does not exist or was moved.'),
      h('div', { class: 'toolbar' }, h('a', { class: 'btn btn-primary', href: routeHref.home() }, 'Go to home page'), h('a', { class: 'btn btn-secondary', href: routeHref.tools() }, 'Browse all tools')),
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
  document.querySelectorAll('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));
  try {
    switch (route.name) {
      case 'home':
        setMeta(`${APP_NAME} — ${TAGLINE}`, SUBTITLE);
        cleanup = homePage(main);
        break;
      case 'tools':
        setMeta(`All Tools | ${APP_NAME}`, 'Every free, private, in-browser file tool: images, PDF, data, text, ZIP, audio and developer utilities.');
        document.querySelector('[data-nav="tools"]')?.setAttribute('aria-current', 'page');
        toolsPage(main);
        break;
      case 'category': {
        const cat = categoryById(route.id);
        if (!cat || !categoryPage(main, route.id)) return notFound(main);
        setMeta(`${cat.name} Tools — Free & Private | ${APP_NAME}`, cat.description);
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
    render(main, h('div', { class: 'error-panel', role: 'alert' }, h('strong', null, 'Something went wrong while loading this page.'), h('p', null, 'Please reload the page.')));
  }
  if (opts.scroll) window.scrollTo({ top: 0 });
  // Move focus to the main heading for screen reader users after navigation.
  const h1 = main.querySelector('h1');
  if (h1 && opts.scroll) {
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }
}

export function startApp(): void {
  document.querySelector('[data-action="search"]')?.addEventListener('click', () => openSearch());
  document.querySelector('[data-action="settings"]')?.addEventListener('click', () => openSettings());
  document.documentElement.classList.add('js');
  startRouter(show);
}
