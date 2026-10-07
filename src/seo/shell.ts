/**
 * Static HTML rendering used at build time (and by the dev server) to produce
 * a crawlable page for every route: <head> meta, JSON-LD, header, footer and
 * a no-JS version of the page content. The client app replaces #main on boot.
 *
 * Runs in Node — strings only, no DOM APIs.
 */
import { APP_NAME, APP_SHORT_NAME, GITHUB_URL, PRIVACY_SHORT, SUBTITLE, TAGLINE } from '../config.ts';
import { CATEGORIES, TOOLS, categoryById, primaryTools, toolById, toolsInCategory } from '../tools/catalog.ts';
import { COMMON_TASKS, conversionLabel, formatTags } from '../tools/formats.ts';
import type { ToolMeta } from '../tools/types.ts';
import { ICONS } from '../components/icons.ts';
import { howToSteps, relatedTools, toolAbout, toolDescription, toolFaq, toolTitle } from './content.ts';
import { LANGS, LANG_NAMES, langPrefix, plural, tr, type Lang } from '../i18n/i18n.ts';
import { loc, locCategory } from '../i18n/localize.ts';

export const THEME_INIT_SCRIPT =
  "(function(){try{var s=JSON.parse(localStorage.getItem('uft-settings')||'{}');var t=s.theme||'system';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ic = (name: string, cls = 'icon'): string =>
  (ICONS[name] ?? ICONS.file).replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `);


export interface PageSpec {
  /** Route path relative to the site root, incl. language prefix, e.g. "ru/tools/zip/" ("" for home). */
  path: string;
  /** Route without language prefix, e.g. "tools/zip/". */
  route: string;
  lang: Lang;
  title: string;
  description: string;
  body: string;
  jsonLd: object[];
  noindex?: boolean;
}

export interface RenderOpts {
  /** Prefix used for in-site links/assets on this page ("./", "../../" or "/repo/"). */
  base: string;
  /** Absolute site URL ending with "/", if known (for canonical/OG). */
  siteUrl?: string;
  /** Content-Security-Policy to embed as <meta>, if any. */
  csp?: string;
}

export function renderHead(page: PageSpec, o: RenderOpts): string {
  const canonical = o.siteUrl ? o.siteUrl + page.path : undefined;
  const ogImage = o.siteUrl ? `${o.siteUrl}icons/og-image.png` : undefined;
  const alternates = !page.noindex && o.siteUrl
    ? [
        ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(o.siteUrl + langPrefix(l) + page.route)}">`),
        `<link rel="alternate" hreflang="x-default" href="${esc(o.siteUrl + page.route)}">`,
      ]
    : [];
  return [
    o.csp ? `<meta http-equiv="Content-Security-Policy" content="${esc(o.csp)}">` : '',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? '<meta name="robots" content="noindex">' : '',
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    ...alternates,
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#f4f2ed" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#151513" media="(prefers-color-scheme: dark)">',
    `<meta name="application-name" content="${esc(APP_SHORT_NAME)}">`,
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    `<meta name="apple-mobile-web-app-title" content="${esc(APP_SHORT_NAME)}">`,
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="format-detection" content="telephone=no">',
    `<link rel="manifest" href="${o.base}manifest.webmanifest">`,
    `<link rel="icon" href="${o.base}favicon.ico" sizes="32x32">`,
    `<link rel="icon" href="${o.base}icons/icon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${o.base}icons/apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="${page.lang === 'ru' ? 'ru_RU' : 'en_US'}">`,
    `<meta property="og:site_name" content="${esc(APP_NAME)}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
    ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<script>${THEME_INIT_SCRIPT}</script>`,
    ...page.jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** Language switcher links (the client keeps hrefs in sync on SPA navigation). */
function langSwitch(base: string, route: string, lang: Lang): string {
  return `<nav class="lang-switch" aria-label="${esc(tr(lang, 'Language'))}">${LANGS.map(
    (l) => `<a href="${base}${langPrefix(l)}${route}" hreflang="${l}" lang="${l}" data-lang-link="${l}" title="${esc(LANG_NAMES[l])}"${l === lang ? ' aria-current="true"' : ''}>${l.toUpperCase()}</a>`,
  ).join('')}</nav>`;
}

/** Categories shown directly in the header; the rest are one click away in "All tools". */
const NAV_CATEGORIES = ['image', 'pdf', 'data', 'text'];

function header(base: string, route: string, lang: Lang): string {
  const p = base + langPrefix(lang);
  const navLinks = NAV_CATEGORIES.map((id) => `<a href="${p}category/${id}/" data-nav="category/${id}">${esc(locCategory(categoryById(id)!, lang).name)}</a>`).join('');
  const menuCats = CATEGORIES.map((c) => `<li><a href="${p}category/${c.id}/" data-nav="category/${c.id}"><span class="cat-dot cat-${c.id}"></span>${esc(locCategory(c, lang).name)}<span class="count">${toolsInCategory(c.id).length}</span></a></li>`).join('');
  return `<a class="skip-link" href="#main">${esc(tr(lang, 'Skip to content'))}</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="${p}" aria-label="${esc(APP_NAME)} — ${esc(tr(lang, 'home'))}">${ic('logo', 'icon logo-mark')}<span class="logo-text">File<b>Toolbox</b></span></a>
      <nav class="header-nav" aria-label="${esc(tr(lang, 'Main'))}">${navLinks}<a class="nav-all" href="${p}tools/" data-nav="tools">${esc(tr(lang, 'All tools'))}</a></nav>
      <button type="button" class="header-search" data-action="search" aria-label="${esc(tr(lang, 'Search tools'))}" aria-keyshortcuts="Control+K /">${ic('search')}<span class="header-search-text">${esc(tr(lang, 'Search tools…'))}</span><kbd>/</kbd></button>
      <div class="header-actions">
        <span class="hide-sm">${langSwitch(base, route, lang)}</span>
        <button type="button" class="icon-btn" data-action="settings" aria-label="${esc(tr(lang, 'Settings'))}" title="${esc(tr(lang, 'Settings'))}">${ic('settings')}</button>
        <button type="button" class="icon-btn menu-btn" data-action="menu" aria-expanded="false" aria-controls="mobile-nav" aria-label="${esc(tr(lang, 'Menu'))}">${ic('menu')}</button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobile-nav" aria-label="${esc(tr(lang, 'Categories'))}" hidden>
      <div class="container mobile-nav-inner">
        <ul>${menuCats}<li><a href="${p}tools/" data-nav="tools">${esc(tr(lang, 'All tools'))}<span class="count">${primaryTools().length}</span></a></li></ul>
        <div class="mobile-nav-foot">${langSwitch(base, route, lang)}<a class="btn btn-ghost btn-sm" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer" data-external>${ic('github')}<span>GitHub</span></a></div>
      </div>
    </nav>
  </header>`;
}

function footer(base: string, route: string, lang: Lang): string {
  const p = base + langPrefix(lang);
  const cats = CATEGORIES.map((c) => `<li><a href="${p}category/${c.id}/">${esc(locCategory(c, lang).name)}</a></li>`).join('');
  const langs = LANGS.map((l) => `<li><a href="${base}${langPrefix(l)}${route}" hreflang="${l}" lang="${l}" data-lang-link="${l}">${esc(LANG_NAMES[l])}</a></li>`).join('');
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="logo" href="${p}">${ic('logo', 'icon logo-mark')}<span class="logo-text">File<b>Toolbox</b></span></a>
        <p>${esc(tr(lang, '{count} for images, PDF, data, text, archives and audio. Files are processed on your device and never uploaded.', { count: plural(primaryTools().length, 'tool', lang) }))}</p>
        <p class="footer-meta">${esc(tr(lang, 'Open source, MIT licence. No tracking, no cookies.'))} <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer" data-external>GitHub</a></p>
      </div>
      <nav class="footer-cats" aria-label="${esc(tr(lang, 'Categories'))}"><h2 class="footer-title">${esc(tr(lang, 'Categories'))}</h2><ul>${cats}<li><a href="${p}tools/">${esc(tr(lang, 'All tools'))}</a></li></ul></nav>
      <nav aria-label="${esc(tr(lang, 'Language'))}"><h2 class="footer-title">${esc(tr(lang, 'Language'))}</h2><ul>${langs}</ul></nav>
    </div>
  </footer>`;
}

export function renderBody(page: PageSpec, o: RenderOpts): string {
  return `${header(o.base, page.route, page.lang)}
  <main id="main" class="container main" tabindex="-1">
${page.body}
  </main>
  ${footer(o.base, page.route, page.lang)}
  <div id="sr-live" class="sr-only" aria-live="polite" aria-atomic="true"></div>`;
}

/* ---------------- static page bodies (no-JS / crawler view) ---------------- */

const fmts = (t: ToolMeta): string => `<span class="fmts" aria-hidden="true">${formatTags(t).map((f) => `<span class="fmt">${esc(f)}</span>`).join('')}</span>`;
const toolRow = (t: ToolMeta, p: string, lang: Lang): string => {
  const l = loc(t, lang);
  return `<li><a class="tool-row" href="${p}tools/${t.id}/"><span class="tool-icon cat-${t.category}">${ic(t.icon)}</span><span class="tool-row-body"><span class="tool-row-name">${esc(l.name)}</span><span class="tool-row-desc">${esc(l.description)}</span></span>${fmts(t)}</a></li>`;
};
const list = (tools: ToolMeta[], p: string, lang: Lang, columns = false): string => `<ul class="tool-list${columns ? ' tool-list-2' : ''}" role="list">${tools.map((t) => toolRow(t, p, lang)).join('')}</ul>`;
const dir = (p: string, lang: Lang, variants = false): string =>
  `<div class="dir">${CATEGORIES.map((c) => {
    const tools = toolsInCategory(c.id);
    const vs = variants ? toolsInCategory(c.id, true).filter((x) => x.variantOf) : [];
    return `<section class="dir-group cat-${c.id}"><h3 class="dir-head"><span class="cat-dot"></span><a href="${p}category/${c.id}/">${esc(locCategory(c, lang).name)}</a><span class="dir-count">${tools.length}</span></h3><ul role="list">${tools.map((t) => `<li><a href="${p}tools/${t.id}/"><span class="dir-name">${esc(loc(t, lang).name)}</span></a></li>`).join('')}</ul>${vs.length ? `<div class="dir-variants">${vs.map((v) => { const conv = conversionLabel(v); return conv ? `<a class="fmt" href="${p}tools/${v.id}/" title="${esc(loc(v, lang).name)}">${esc(conv)}</a>` : `<a class="dir-variant" href="${p}tools/${v.id}/">${esc(loc(v, lang).name)}</a>`; }).join('')}</div>` : ''}</section>`;
  }).join('')}</div>`;
const catLinks = (p: string, lang: Lang, exclude?: string): string =>
  `<ul class="category-chips" role="list">${CATEGORIES.filter((c) => c.id !== exclude).map((c) => `<li><a class="category-chip cat-${c.id}" href="${p}category/${c.id}/"><span class="cat-dot"></span>${esc(locCategory(c, lang).name)}</a></li>`).join('')}</ul>`;
const crumbs = (items: [string, string | null][]): string =>
  `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map(([l, h], i) => (h ? `<li><a href="${h}">${esc(l)}</a></li>` : `<li><span${i === items.length - 1 ? ' aria-current="page"' : ''}>${esc(l)}</span></li>`)).join('')}</ol></nav>`;
const noscript = (lang: Lang) => `<noscript><div class="notice notice-warn"><div>${esc(tr(lang, 'JavaScript is required to process files. All processing happens locally in your browser — please enable JavaScript.'))}</div></div></noscript>`;
const head2 = (title: string, extra = ''): string => `<div class="section-head"><h2>${title}</h2>${extra}</div>`;

function homeBody(p: string, lang: Lang): string {
  const common = COMMON_TASKS.map((id) => toolById(id)).filter((x): x is ToolMeta => Boolean(x));
  return `<section class="intro">
      <div class="intro-text">
        <h1>${esc(tr(lang, TAGLINE))}</h1>
        <p class="intro-sub">${esc(tr(lang, SUBTITLE))}</p>
        <ul class="intro-facts" role="list"><li><b>${primaryTools().length}</b>${esc(`${plural(primaryTools().length, 'tool', lang).replace(/^\S+\s/, '')} ${tr(lang, 'in {n} categories', { n: CATEGORIES.length })}`)}</li><li><b>0 B</b>${esc(tr(lang, 'sent to any server'))}</li><li><b>PWA</b>${esc(tr(lang, 'works offline'))}</li></ul>
      </div>
      <div class="dropzone" data-dropzone><div class="dropzone-icon">${ic('upload', 'icon icon-xl')}</div><p class="dropzone-title">${esc(tr(lang, 'Drop files here'))}</p><p class="dropzone-sub">${esc(tr(lang, 'or'))}</p><div class="dropzone-actions"><span class="btn btn-primary btn-lg">${ic('upload')}<span>${esc(tr(lang, 'Choose Files'))}</span></span></div><p class="dropzone-formats">${esc(tr(lang, 'Images, PDF, ZIP, CSV, JSON, text, audio — or any file'))}</p></div>
    </section>
    ${noscript(lang)}
    <div class="home-split">
      <section>${head2(esc(tr(lang, 'Common tasks')), `<a class="link-more" href="${p}tools/">${esc(tr(lang, 'All tools'))}</a>`)}${list(common, p, lang)}</section>
      <aside class="privacy-note"><h2>${esc(tr(lang, 'Where your files go'))}</h2><ul><li>${esc(tr(lang, 'Nowhere. Files are read by your browser and processed on this device with JavaScript and WebAssembly.'))}</li><li>${esc(tr(lang, 'The page’s security policy blocks connections to other servers, so a file can’t be sent even by mistake.'))}</li><li>${esc(tr(lang, 'After the first visit the tools also work offline.'))}</li></ul><p><a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">${esc(tr(lang, 'Check the source code on GitHub'))}</a></p></aside>
    </div>
    <section class="section">${head2(`${esc(tr(lang, 'All tools'))}<span class="count">${primaryTools().length}</span>`)}${dir(p, lang)}</section>`;
}

function toolsBody(p: string, lang: Lang): string {
  return `${crumbs([[tr(lang, 'Home'), p], [tr(lang, 'All tools'), null]])}
    <header class="page-head"><h1>${esc(tr(lang, 'All tools'))}</h1><p class="lead">${esc(tr(lang, '{count} in {n} categories. Everything runs in your browser.', { count: plural(primaryTools().length, 'tool', lang), n: CATEGORIES.length }))}</p></header>
    ${dir(p, lang, true)}`;
}

function categoryBody(id: string, p: string, lang: Lang): string {
  const c = locCategory(categoryById(id)!, lang);
  const variants = toolsInCategory(id, true).filter((x) => x.variantOf);
  return `${crumbs([[tr(lang, 'Home'), p], [tr(lang, 'Tools'), `${p}tools/`], [c.name, null]])}
    <header class="page-head cat-${c.id}"><h1>${esc(tr(lang, '{name} tools', { name: c.name }))}</h1><p class="lead">${esc(c.description)}</p></header>
    ${list(toolsInCategory(id), p, lang)}
    ${variants.length ? `<section class="section">${head2(esc(tr(lang, 'Quick converters & presets')))}${list(variants, p, lang, true)}</section>` : ''}
    <section class="section">${head2(esc(tr(lang, 'Other categories')))}${catLinks(p, lang, id)}</section>`;
}

function toolBody(t: ToolMeta, p: string, lang: Lang): string {
  const cat = locCategory(categoryById(t.category)!, lang);
  const l = loc(t, lang);
  return `${crumbs([[tr(lang, 'Home'), p], [cat.name, `${p}category/${cat.id}/`], [l.name, null]])}
    <header class="tool-head"><div><h1>${esc(l.name)}</h1><p class="lead">${esc(l.description)}</p></div><div class="tool-head-meta">${fmts(t)}<p class="privacy-line">${ic('lock')}${esc(tr(lang, PRIVACY_SHORT))}</p></div></header>
    <div class="tool-root" id="tool-root"><div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(tr(lang, 'Loading tool…'))}</div>${noscript(lang)}</div>
    <section class="tool-info">
      <div><h2>${esc(tr(lang, 'About: {name}', { name: l.name }))}</h2>
      <p>${esc(toolAbout(t, lang))}</p>
      <h3>${esc(tr(lang, 'How to use'))}</h3>
      <ol class="steps">${howToSteps(t, lang).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <div><h2>${esc(tr(lang, 'Frequently asked questions'))}</h2>
      <div class="faq">${toolFaq(t, lang).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div></div>
    </section>
    <section class="section">${head2(esc(tr(lang, 'Related tools')))}${list(relatedTools(t), p, lang, true)}</section>`;
}

/* ---------------- JSON-LD ---------------- */

function breadcrumbLd(items: [string, string][], siteUrl?: string): object | null {
  if (!siteUrl) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: siteUrl + path })),
  };
}

function toolLd(t: ToolMeta, lang: Lang, siteUrl?: string): object[] {
  const cat = locCategory(categoryById(t.category)!, lang);
  const l = loc(t, lang);
  const lp = langPrefix(lang);
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: l.name,
    description: toolDescription(t, lang),
    inLanguage: lang,
    applicationCategory: t.category === 'developer' ? 'DeveloperApplication' : 'UtilitiesApplication',
    operatingSystem: 'Any (modern web browser)',
    browserRequirements: 'Requires JavaScript. Works offline after first visit.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(siteUrl ? { url: `${siteUrl}${lp}tools/${t.id}/` } : {}),
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: toolFaq(t, lang).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    inLanguage: lang,
    name: tr(lang, 'How to use: {name}', { name: l.name }),
    step: howToSteps(t, lang).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  };
  const bc = breadcrumbLd([[tr(lang, 'Home'), lp], [cat.name, `${lp}category/${cat.id}/`], [l.name, `${lp}tools/${t.id}/`]], siteUrl);
  return [app, faq, howTo, ...(bc ? [bc] : [])];
}

/* ---------------- page list ---------------- */

export type PageFactory = (base: string) => PageSpec;

export function allPages(siteUrl?: string): PageFactory[] {
  const pages: PageFactory[] = [];
  for (const lang of LANGS) {
    const lp = langPrefix(lang);
    const mk = (route: string, f: (p: string) => Omit<PageSpec, 'path' | 'route' | 'lang'>): PageFactory => (base) => ({ path: lp + route, route, lang, ...f(base + lp) });
    pages.push(
      mk('', (p) => ({
        title: `${APP_NAME} — ${tr(lang, TAGLINE)}`,
        description: tr(lang, SUBTITLE),
        body: homeBody(p, lang),
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'WebSite', name: APP_NAME, inLanguage: lang, description: tr(lang, SUBTITLE), ...(siteUrl ? { url: siteUrl + lp } : {}) },
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: APP_NAME,
            inLanguage: lang,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: primaryTools().map((t) => loc(t, lang).name),
          },
        ],
      })),
    );
    pages.push(
      mk('tools/', (p) => ({
        title: `${tr(lang, 'All Tools')} | ${APP_NAME}`,
        description: tr(lang, 'Every free, private, in-browser file tool: images, PDF, data, text, ZIP, audio and developer utilities.'),
        body: toolsBody(p, lang),
        jsonLd: [],
      })),
    );
    for (const c of CATEGORIES) {
      const lc = locCategory(c, lang);
      pages.push(
        mk(`category/${c.id}/`, (p) => ({
          title: `${tr(lang, '{name} Tools — Free & Private', { name: lc.name })} | ${APP_NAME}`,
          description: lc.description,
          body: categoryBody(c.id, p, lang),
          jsonLd: [breadcrumbLd([[tr(lang, 'Home'), lp], [lc.name, `${lp}category/${c.id}/`]], siteUrl)].filter(Boolean) as object[],
        })),
      );
    }
    for (const t of TOOLS) {
      pages.push(
        mk(`tools/${t.id}/`, (p) => ({
          title: toolTitle(t, lang),
          description: toolDescription(t, lang),
          body: toolBody(t, p, lang),
          jsonLd: toolLd(t, lang, siteUrl),
        })),
      );
    }
  }
  return pages;
}

export function notFoundPage(): PageSpec {
  return {
    path: '404.html',
    route: '',
    lang: 'en',
    title: `Page not found | ${APP_NAME}`,
    description: 'The page you are looking for does not exist.',
    body: `<section class="not-found"><h1>Page not found</h1><p class="lead">The page you are looking for does not exist or was moved.</p></section>`,
    jsonLd: [],
    noindex: true,
  };
}
