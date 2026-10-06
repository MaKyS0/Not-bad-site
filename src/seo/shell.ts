/**
 * Static HTML rendering used at build time (and by the dev server) to produce
 * a crawlable page for every route: <head> meta, JSON-LD, header, footer and
 * a no-JS version of the page content. The client app replaces #main on boot.
 *
 * Runs in Node — strings only, no DOM APIs.
 */
import { APP_NAME, APP_SHORT_NAME, GITHUB_URL, PRIVACY_TEXT, SUBTITLE, TAGLINE } from '../config.ts';
import { CATEGORIES, TOOLS, categoryById, popularTools, primaryTools, toolsInCategory } from '../tools/catalog.ts';
import type { ToolMeta } from '../tools/types.ts';
import { ICONS } from '../components/icons.ts';
import { howToSteps, relatedTools, toolAbout, toolDescription, toolFaq, toolTitle } from './content.ts';

export const THEME_INIT_SCRIPT =
  "(function(){try{var s=JSON.parse(localStorage.getItem('uft-settings')||'{}');var t=s.theme||'system';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ic = (name: string, cls = 'icon'): string =>
  (ICONS[name] ?? ICONS.file).replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `);

export interface PageSpec {
  /** Route path relative to the site root, e.g. "tools/zip/" ("" for home). */
  path: string;
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
  return [
    o.csp ? `<meta http-equiv="Content-Security-Policy" content="${esc(o.csp)}">` : '',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? '<meta name="robots" content="noindex">' : '',
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0b0f17" media="(prefers-color-scheme: dark)">',
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

function header(base: string): string {
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="${base}" aria-label="${esc(APP_NAME)} — home">${ic('logo', 'icon logo-mark')}<span class="logo-text">File<span>Toolbox</span></span></a>
      <nav class="header-nav" aria-label="Main">
        <a href="${base}tools/" data-nav="tools">${ic('grid')}<span>Tools</span></a>
      </nav>
      <button type="button" class="header-search" data-action="search" aria-label="Search tools" aria-keyshortcuts="Control+K /">${ic('search')}<span class="header-search-text">Search tools…</span><kbd>/</kbd></button>
      <div class="header-actions">
        <a class="icon-btn" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub" title="GitHub" data-external>${ic('github')}</a>
        <button type="button" class="icon-btn" data-action="settings" aria-label="Settings" title="Settings">${ic('settings')}</button>
      </div>
    </div>
  </header>`;
}

function footer(base: string): string {
  const cats = CATEGORIES.map((c) => `<li><a href="${base}category/${c.id}/">${esc(c.name)}</a></li>`).join('');
  const pop = popularTools()
    .slice(0, 8)
    .map((t) => `<li><a href="${base}tools/${t.id}/">${esc(t.name)}</a></li>`)
    .join('');
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="logo" href="${base}">${ic('logo', 'icon logo-mark')}<span class="logo-text">File<span>Toolbox</span></span></a>
        <p class="privacy-line">${ic('lock')}${esc(PRIVACY_TEXT)}</p>
        <p class="muted small">Open source · No tracking · No cookies · <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer" data-external>GitHub</a></p>
      </div>
      <nav aria-label="Categories"><h2 class="footer-title">Categories</h2><ul>${cats}</ul></nav>
      <nav aria-label="Popular tools"><h2 class="footer-title">Popular</h2><ul>${pop}</ul></nav>
    </div>
  </footer>`;
}

export function renderBody(page: PageSpec, o: RenderOpts): string {
  return `${header(o.base)}
  <main id="main" class="container main" tabindex="-1">
${page.body}
  </main>
  ${footer(o.base)}
  <div id="sr-live" class="sr-only" aria-live="polite" aria-atomic="true"></div>`;
}

/* ---------------- static page bodies (no-JS / crawler view) ---------------- */

const toolLink = (t: ToolMeta, base: string): string =>
  `<li><a class="tool-card" href="${base}tools/${t.id}/"><span class="tool-icon cat-${t.category}">${ic(t.icon)}</span><span class="tool-card-body"><strong class="tool-card-title">${esc(t.name)}</strong><span class="tool-card-desc">${esc(t.description)}</span></span></a></li>`;

const grid = (tools: ToolMeta[], base: string): string => `<ul class="tool-grid" role="list">${tools.map((t) => toolLink(t, base)).join('')}</ul>`;

const chips = (base: string): string =>
  `<ul class="category-chips" role="list">${CATEGORIES.map((c) => `<li><a class="category-chip cat-${c.id}" href="${base}category/${c.id}/">${ic(c.icon)}<span>${esc(c.name.toUpperCase())}</span></a></li>`).join('')}</ul>`;

const crumbs = (items: [string, string | null][]): string =>
  `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map(([l, h], i) => (h ? `<li><a href="${h}">${esc(l)}</a></li>` : `<li><span${i === items.length - 1 ? ' aria-current="page"' : ''}>${esc(l)}</span></li>`)).join('')}</ol></nav>`;

const noscript = `<noscript><div class="notice notice-warn"><div>JavaScript is required to process files. All processing happens locally in your browser — please enable JavaScript.</div></div></noscript>`;

function homeBody(base: string): string {
  return `<section class="hero">
      <h1 class="hero-title">${esc(TAGLINE)}</h1>
      <p class="hero-sub">${esc(SUBTITLE)}</p>
      <div class="dropzone" data-dropzone><div class="dropzone-icon">${ic('upload', 'icon icon-xl')}</div><p class="dropzone-title">DROP FILES HERE</p><p class="dropzone-sub">or</p><div class="dropzone-actions"><span class="btn btn-primary btn-lg">${ic('upload')}<span>Choose Files</span></span></div></div>
      <p class="privacy-line">${ic('lock')}${esc(PRIVACY_TEXT)}</p>
      ${noscript}
    </section>
    <section class="section"><div class="section-head"><h2>Categories</h2></div>${chips(base)}</section>
    <section class="section"><div class="section-head"><h2>Popular tools</h2></div>${grid(popularTools().slice(0, 12), base)}</section>
    <section class="section"><div class="section-head"><h2>All tools</h2></div>${CATEGORIES.map((c) => `<div class="category-block"><h3 class="category-title"><a href="${base}category/${c.id}/">${esc(c.name)}</a></h3>${grid(toolsInCategory(c.id), base)}</div>`).join('')}</section>`;
}

function toolsBody(base: string): string {
  return `${crumbs([['Home', base], ['All tools', null]])}
    <header class="page-head"><h1>All tools</h1><p class="lead">${TOOLS.length} free tools that run entirely in your browser.</p></header>
    ${chips(base)}
    ${CATEGORIES.map((c) => `<section class="category-block"><h2 class="category-title"><a href="${base}category/${c.id}/">${esc(c.name)}</a></h2>${grid(toolsInCategory(c.id, true), base)}</section>`).join('')}`;
}

function categoryBody(id: string, base: string): string {
  const c = categoryById(id)!;
  return `${crumbs([['Home', base], ['Tools', `${base}tools/`], [c.name, null]])}
    <header class="page-head"><span class="tool-icon tool-icon-lg cat-${c.id}">${ic(c.icon)}</span><div><h1>${esc(c.name)} tools</h1><p class="lead">${esc(c.description)}</p></div></header>
    ${grid(toolsInCategory(id, true), base)}`;
}

function toolBody(t: ToolMeta, base: string): string {
  const cat = categoryById(t.category)!;
  return `${crumbs([['Home', base], [cat.name, `${base}category/${cat.id}/`], [t.name, null]])}
    <header class="tool-head"><span class="tool-icon tool-icon-lg cat-${t.category}">${ic(t.icon)}</span><div><h1>${esc(t.name)}</h1><p class="lead">${esc(t.description)}</p></div></header>
    <p class="privacy-line privacy-line-sm">${ic('lock')}${esc(PRIVACY_TEXT)}</p>
    <div class="tool-root" id="tool-root"><div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>Loading tool…</div>${noscript}</div>
    <section class="tool-info">
      <h2>About the ${esc(t.name)}</h2>
      <p>${esc(toolAbout(t))}</p>
      <h3>How to use</h3>
      <ol class="steps">${howToSteps(t).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <h2>Frequently asked questions</h2>
      <div class="faq">${toolFaq(t).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
    </section>
    <section class="section"><h2>Related tools</h2>${grid(relatedTools(t), base)}</section>`;
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

function toolLd(t: ToolMeta, siteUrl?: string): object[] {
  const cat = categoryById(t.category)!;
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t.name,
    description: toolDescription(t),
    applicationCategory: t.category === 'developer' ? 'DeveloperApplication' : 'UtilitiesApplication',
    operatingSystem: 'Any (modern web browser)',
    browserRequirements: 'Requires JavaScript. Works offline after first visit.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(siteUrl ? { url: `${siteUrl}tools/${t.id}/` } : {}),
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: toolFaq(t).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to use the ${t.name}`,
    step: howToSteps(t).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  };
  const bc = breadcrumbLd([['Home', ''], [cat.name, `category/${cat.id}/`], [t.name, `tools/${t.id}/`]], siteUrl);
  return [app, faq, howTo, ...(bc ? [bc] : [])];
}

/* ---------------- page list ---------------- */

export function allPages(siteUrl?: string): ((base: string) => PageSpec)[] {
  const pages: ((base: string) => PageSpec)[] = [];
  pages.push((base) => ({
    path: '',
    title: `${APP_NAME} — ${TAGLINE}`,
    description: SUBTITLE,
    body: homeBody(base),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: APP_NAME,
        description: SUBTITLE,
        ...(siteUrl ? { url: siteUrl } : {}),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: APP_NAME,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: primaryTools().map((t) => t.name),
      },
    ],
  }));
  pages.push((base) => ({
    path: 'tools/',
    title: `All Tools | ${APP_NAME}`,
    description: 'Every free, private, in-browser file tool: images, PDF, data, text, ZIP, audio and developer utilities.',
    body: toolsBody(base),
    jsonLd: [],
  }));
  for (const c of CATEGORIES) {
    pages.push((base) => ({
      path: `category/${c.id}/`,
      title: `${c.name} Tools — Free & Private | ${APP_NAME}`,
      description: c.description,
      body: categoryBody(c.id, base),
      jsonLd: [breadcrumbLd([['Home', ''], [c.name, `category/${c.id}/`]], siteUrl)].filter(Boolean) as object[],
    }));
  }
  for (const t of TOOLS) {
    pages.push((base) => ({
      path: `tools/${t.id}/`,
      title: toolTitle(t),
      description: toolDescription(t),
      body: toolBody(t, base),
      jsonLd: toolLd(t, siteUrl),
    }));
  }
  return pages;
}

export function notFoundPage(): PageSpec {
  return {
    path: '404.html',
    title: `Page not found | ${APP_NAME}`,
    description: 'The page you are looking for does not exist.',
    body: `<section class="not-found"><h1>Page not found</h1><p class="lead">The page you are looking for does not exist or was moved.</p></section>`,
    jsonLd: [],
    noindex: true,
  };
}
