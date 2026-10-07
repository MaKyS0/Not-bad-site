import { h, render } from '../utils/dom';
import { icon } from '../components/icons';
import { errorPanel } from '../components/ui';
import { getTool } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import { takeFiles } from '../services/fileStore';
import { loadToolSettings, recordToolUse, saveToolSettings } from '../services/history';
import { routeHref } from '../services/router';
import { toolAbout, toolFaq, howToSteps, relatedTools, categoryName } from '../seo/content';
import { breadcrumbs } from './listing';
import { toolGrid } from '../components/toolCard';
import { PRIVACY_TEXT } from '../config';
import { t } from '../i18n/i18n';
import { inertBlob, isActiveContent, svgDataUrl } from '../utils/safeUrl';
import { loc } from '../i18n/localize';

/** Mount a tool page. Returns a cleanup function (or null if the tool doesn't exist). */
export function toolPage(root: HTMLElement, id: string): (() => void) | null {
  const tool = getTool(id);
  if (!tool) return null;

  const urls = new Set<string>();
  const cleanups: (() => void)[] = [];
  const controller = new AbortController();
  let disposed = false;

  const ctx: ToolContext = {
    meta: tool,
    preset: tool.preset ?? {},
    initialFiles: takeFiles(tool.id),
    objectUrl(blob) {
      const url = URL.createObjectURL(inertBlob(blob));
      urls.add(url);
      return url;
    },
    async imageUrl(blob) {
      return isActiveContent(blob) ? svgDataUrl(blob) : ctx.objectUrl(blob);
    },
    revokeUrl(url) {
      if (urls.delete(url)) URL.revokeObjectURL(url);
    },
    onCleanup(fn) {
      cleanups.push(fn);
    },
    signal: controller.signal,
    loadSettings: (defaults) => loadToolSettings(tool.id, defaults),
    saveSettings: (s) => saveToolSettings(tool.id, s),
    recordUse: (s) => void recordToolUse(tool.id, s),
  };

  const mountPoint = h('div', { class: 'tool-root', id: 'tool-root' }, h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), t('Loading tool…')));

  const mount = async () => {
    try {
      const mod = await tool.load();
      if (disposed) return;
      mountPoint.replaceChildren();
      const result = await mod.mount(mountPoint, ctx);
      if (typeof result === 'function') cleanups.push(result);
    } catch (e) {
      if (disposed) return;
      const offline = !navigator.onLine;
      render(
        mountPoint,
        errorPanel(
          offline ? Object.assign(new Error(t('Tool code is not cached yet and you are offline.')), { name: 'OfflineError' }) : e,
          () => {
            render(mountPoint, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('Loading tool…')));
            void mount();
          },
          t('Retry'),
        ),
      );
    }
  };

  const faq = toolFaq(tool);
  const l = loc(tool);
  render(
    root,
    breadcrumbs([[t('Home'), routeHref.home()], [categoryName(tool.category), routeHref.category(tool.category)], [l.name, null]]),
    h(
      'header',
      { class: 'tool-head' },
      h('span', { class: `tool-icon tool-icon-lg cat-${tool.category}` }, icon(tool.icon)),
      h('div', null, h('h1', null, l.name), h('p', { class: 'lead' }, l.description)),
    ),
    h('p', { class: 'privacy-line privacy-line-sm' }, icon('lock'), t(PRIVACY_TEXT)),
    mountPoint,
    h(
      'section',
      { class: 'tool-info', 'aria-labelledby': 'about-h' },
      h('h2', { id: 'about-h' }, t('About: {name}', { name: l.name })),
      h('p', null, toolAbout(tool)),
      h('h3', null, t('How to use')),
      h('ol', { class: 'steps' }, ...howToSteps(tool).map((s) => h('li', null, s))),
      h('h2', { id: 'faq-h' }, t('Frequently asked questions')),
      h('div', { class: 'faq' }, ...faq.map((f) => h('details', null, h('summary', null, f.q), h('p', null, f.a)))),
    ),
    h('section', { class: 'section', 'aria-labelledby': 'rel-h' }, h('h2', { id: 'rel-h' }, t('Related tools')), toolGrid(relatedTools(tool), { label: t('Related tools') })),
    h('div', { class: 'back-row' }, h('a', { class: 'btn btn-ghost', href: routeHref.tools() }, icon('left'), h('span', null, t('All tools')))),
  );
  void mount();

  return () => {
    disposed = true;
    controller.abort();
    for (const fn of cleanups) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
  };
}
