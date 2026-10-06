import { h, render, announce } from '../utils/dom';
import { dropzone } from '../components/dropzone';
import { toolGrid } from '../components/toolCard';
import { icon } from '../components/icons';
import { CATEGORIES, popularTools, toolsInCategory, toolById, primaryTools } from '../tools/catalog';
import { getHistory, onHistoryChange } from '../services/history';
import { suggestTools } from '../services/suggest';
import { handOver, getStaged, setStaged } from '../services/fileStore';
import { navigate, routeHref } from '../services/router';
import { formatBytes, formatRelative } from '../utils/format';
import { guessKind } from '../utils/fileType';
import { PRIVACY_TEXT, SUBTITLE, TAGLINE } from '../config';
import { iconButton, button } from '../components/ui';
import { plural, t } from '../i18n/i18n';
import { loc, locCategory } from '../i18n/localize';
import { HOW_STEPS } from '../seo/howSteps';

export function categoryChips(): HTMLElement {
  return h(
    'ul',
    { class: 'category-chips', role: 'list' },
    ...CATEGORIES.map((c) =>
      h('li', null, h('a', { class: `category-chip cat-${c.id}`, href: routeHref.category(c.id) }, icon(c.icon), h('span', null, locCategory(c).name))),
    ),
  );
}

export function privacyBadges(): HTMLElement {
  return h(
    'ul',
    { class: 'badges-row', role: 'list' },
    h('li', null, icon('shield'), t('No uploads — 100 % local')),
    h('li', null, icon('offline'), t('Works offline (PWA)')),
    h('li', null, icon('zap'), t('Free, no sign-up')),
  );
}

/** Category tabs: "All" shows tools grouped by category, a tab shows one category. */
function toolTabs(): HTMLElement {
  const panel = h('div', { class: 'tab-panel', role: 'tabpanel', id: 'tools-panel' });
  const tabs: HTMLButtonElement[] = [];
  const ids = ['all', ...CATEGORIES.map((c) => c.id)];
  const select = (id: string, focus = false) => {
    tabs.forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    if (id === 'all') {
      render(
        panel,
        ...CATEGORIES.map((c) =>
          h('div', { class: 'category-block' },
            h('h3', { class: 'category-title' }, h('a', { href: routeHref.category(c.id) }, icon(c.icon), locCategory(c).name)),
            toolGrid(toolsInCategory(c.id), { label: locCategory(c).name, compact: true }),
          ),
        ),
      );
    } else {
      const cat = CATEGORIES.find((c) => c.id === id)!;
      render(
        panel,
        h('p', { class: 'muted', style: 'margin:4px 0 12px' }, locCategory(cat).description),
        toolGrid(toolsInCategory(id, true), { label: locCategory(cat).name }),
      );
    }
    try {
      sessionStorage.setItem('uft-home-tab', id);
    } catch {
      /* ignore */
    }
  };
  const list = h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': t('Categories') },
    ...ids.map((id) => {
      const cat = CATEGORIES.find((c) => c.id === id);
      const b = h(
        'button',
        { type: 'button', role: 'tab', class: ['tab', cat && `cat-${cat.id}`], dataset: { tab: id }, 'aria-controls': 'tools-panel', 'aria-selected': 'false' },
        icon(cat ? cat.icon : 'grid'),
        h('span', null, cat ? locCategory(cat).name : t('All')),
        h('span', { class: 'tab-count' }, String(id === 'all' ? primaryTools().length : toolsInCategory(id).length)),
      );
      b.addEventListener('click', () => select(id));
      tabs.push(b);
      return b;
    }),
  );
  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  list.addEventListener('keydown', (e) => {
    const i = tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    select(ids[(next + ids.length) % ids.length], true);
  });
  let initial = 'all';
  try {
    initial = sessionStorage.getItem('uft-home-tab') ?? 'all';
  } catch {
    /* ignore */
  }
  select(ids.includes(initial) ? initial : 'all');
  return h('div', null, h('div', { class: 'tabs-scroll' }, list), panel);
}

export function homePage(root: HTMLElement): () => void {
  const filesPanel = h('section', { class: 'staged', 'aria-live': 'polite', hidden: true });

  const showStaged = (files: File[]) => {
    setStaged(files);
    if (!files.length) {
      filesPanel.hidden = true;
      render(filesPanel);
      return;
    }
    const suggestions = suggestTools(files);
    const list = h(
      'ul',
      { class: 'file-chips', role: 'list' },
      ...files.slice(0, 50).map((f, i) =>
        h(
          'li',
          { class: 'file-chip' },
          h('span', { class: `tool-icon cat-${kindToCat(guessKind(f))}` }, icon(kindIcon(guessKind(f)))),
          h('span', { class: 'file-chip-name', title: f.name }, f.name),
          h('span', { class: 'file-chip-size' }, formatBytes(f.size)),
          iconButton('x', t('Remove {name}', { name: f.name }), () => showStaged(files.filter((_, j) => j !== i)), 'icon-btn-sm'),
        ),
      ),
      files.length > 50 ? h('li', { class: 'file-chip more' }, t('+ {n} more', { n: files.length - 50 })) : null,
    );
    render(
      filesPanel,
      h('div', { class: 'staged-head' },
        h('h2', null, t('{files} selected', { files: plural(files.length, 'file') })),
        button(t('Clear'), { variant: 'ghost', icon: 'x', onClick: () => showStaged([]) }),
      ),
      list,
      suggestions.length
        ? [
            h('h3', { class: 'section-sub' }, files.length > 1 ? t('Process all files with…') : t('What do you want to do?')),
            toolGrid(suggestions, {
              label: t('Suggested tools'),
              onClick: (tool, e) => {
                e.preventDefault();
                handOver(tool.id, files);
                navigate(routeHref.tool(tool.id));
              },
            }),
          ]
        : h('p', { class: 'muted' }, t('No specialised tool for this file type yet. Try the'), ' ', h('a', { href: routeHref.tool('file-inspector') }, loc(toolById('file-inspector')!).name), ' / ', h('a', { href: routeHref.tool('zip') }, loc(toolById('zip')!).name), '.'),
    );
    filesPanel.hidden = false;
    announce(t('{files} selected. {n} suggested tools.', { files: plural(files.length, 'file'), n: suggestions.length }));
    filesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const recentSection = h('section', { class: 'recent', hidden: true, 'aria-labelledby': 'recent-h' });
  const drawRecent = async () => {
    const hist = (await getHistory()).filter((e) => toolById(e.toolId)).slice(0, 8);
    if (!hist.length) {
      recentSection.hidden = true;
      return;
    }
    render(
      recentSection,
      h('h2', { id: 'recent-h', class: 'recent-title' }, icon('clock'), t('Recently used')),
      h('ul', { class: 'recent-list', role: 'list' }, ...hist.map((e) => {
        const tool = toolById(e.toolId)!;
        return h('li', null, h('a', { class: 'recent-chip', href: routeHref.tool(tool.id), title: formatRelative(e.lastUsed) },
          h('span', { class: `tool-icon cat-${tool.category}` }, icon(tool.icon)), h('span', null, loc(tool).name)));
      })),
    );
    recentSection.hidden = false;
  };

  render(
    root,
    h(
      'section',
      { class: 'hero' },
      h('h1', { class: 'hero-title' }, t(TAGLINE)),
      h('p', { class: 'hero-sub' }, t(SUBTITLE)),
      dropzone({ onFiles: showStaged, paste: true, folders: false, title: t('Drop files here'), subtitle: t('or'), hint: t('Images, PDF, ZIP, CSV, JSON, text, audio — or any file'), global: true }),
      h('p', { class: 'privacy-line' }, icon('lock'), t(PRIVACY_TEXT)),
      privacyBadges(),
    ),
    filesPanel,
    recentSection,
    h('section', { class: 'section', 'aria-labelledby': 'pop-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'pop-h' }, icon('star'), t('Popular tools')), h('a', { href: routeHref.tools(), class: 'link-more' }, t('All tools'), icon('right'))),
      toolGrid(popularTools().slice(0, 8), { label: t('Popular tools') }),
    ),
    h('section', { class: 'section', 'aria-labelledby': 'all-h' }, h('div', { class: 'section-head' }, h('h2', { id: 'all-h' }, icon('grid'), t('All tools'))), toolTabs()),
    h('section', { class: 'section', 'aria-labelledby': 'how-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'how-h' }, t('How it works'))),
      h('ol', { class: 'how-steps' }, ...HOW_STEPS.map(([ic, title, text], i) =>
        h('li', { class: 'how-step' }, h('span', { class: 'how-num' }, String(i + 1)), h('span', { class: 'how-icon' }, icon(ic)), h('strong', null, t(title)), h('span', null, t(text))))),
    ),
  );
  if (getStaged().length) showStaged(getStaged());
  void drawRecent();
  return onHistoryChange(() => void drawRecent());
}

export function kindToCat(kind: string): string {
  return kind === 'zip' ? 'archive' : kind === 'other' || kind === 'video' ? 'files' : kind;
}
export function kindIcon(kind: string): string {
  return ({ image: 'image', pdf: 'pdf', zip: 'archive', audio: 'audio', text: 'text', data: 'data' } as Record<string, string>)[kind] ?? 'file';
}
