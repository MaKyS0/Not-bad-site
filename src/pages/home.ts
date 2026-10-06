import { h, render, announce } from '../utils/dom';
import { dropzone } from '../components/dropzone';
import { toolGrid, toolCard } from '../components/toolCard';
import { icon } from '../components/icons';
import { CATEGORIES, popularTools, toolsInCategory, toolById } from '../tools/catalog';
import { getHistory, onHistoryChange } from '../services/history';
import { suggestTools } from '../services/suggest';
import { handOver, getStaged, setStaged } from '../services/fileStore';
import { navigate, routeHref } from '../services/router';
import { formatBytes, formatRelative } from '../utils/format';
import { guessKind } from '../utils/fileType';
import { PRIVACY_TEXT, SUBTITLE, TAGLINE } from '../config';
import { iconButton, button } from '../components/ui';

export function categoryChips(): HTMLElement {
  return h(
    'ul',
    { class: 'category-chips', role: 'list' },
    ...CATEGORIES.map((c) =>
      h('li', null, h('a', { class: `category-chip cat-${c.id}`, href: routeHref.category(c.id) }, icon(c.icon), h('span', null, c.name.toUpperCase()))),
    ),
  );
}

export function privacyBadges(): HTMLElement {
  return h(
    'ul',
    { class: 'badges-row', role: 'list' },
    h('li', null, icon('shield'), 'No uploads — 100 % local'),
    h('li', null, icon('offline'), 'Works offline (PWA)'),
    h('li', null, icon('zap'), 'Free, no sign-up'),
  );
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
          iconButton('x', `Remove ${f.name}`, () => showStaged(files.filter((_, j) => j !== i)), 'icon-btn-sm'),
        ),
      ),
      files.length > 50 ? h('li', { class: 'file-chip more' }, `+ ${files.length - 50} more`) : null,
    );
    render(
      filesPanel,
      h('div', { class: 'staged-head' },
        h('h2', null, `${files.length} file${files.length > 1 ? 's' : ''} selected`),
        button('Clear', { variant: 'ghost', icon: 'x', onClick: () => showStaged([]) }),
      ),
      list,
      suggestions.length
        ? [
            h('h3', { class: 'section-sub' }, files.length > 1 ? 'Process all files with…' : 'What do you want to do?'),
            toolGrid(suggestions, {
              label: 'Suggested tools',
              onClick: (tool, e) => {
                e.preventDefault();
                handOver(tool.id, files);
                navigate(routeHref.tool(tool.id));
              },
            }),
          ]
        : h('p', { class: 'muted' }, 'No specialised tool for this file type yet. Try the ', h('a', { href: routeHref.tool('file-inspector') }, 'File Inspector'), ' or ', h('a', { href: routeHref.tool('zip') }, 'ZIP Creator'), '.'),
    );
    filesPanel.hidden = false;
    announce(`${files.length} files selected. ${suggestions.length} suggested tools.`);
    filesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const recentSection = h('section', { class: 'section', hidden: true, 'aria-labelledby': 'recent-h' });
  const drawRecent = async () => {
    const hist = (await getHistory()).filter((e) => toolById(e.toolId)).slice(0, 6);
    if (!hist.length) {
      recentSection.hidden = true;
      return;
    }
    render(
      recentSection,
      h('div', { class: 'section-head' }, h('h2', { id: 'recent-h' }, icon('clock'), 'Recently used')),
      h('ul', { class: 'tool-grid', role: 'list' }, ...hist.map((e) => h('li', null, toolCard(toolById(e.toolId)!, { meta: formatRelative(e.lastUsed) })))),
    );
    recentSection.hidden = false;
  };

  render(
    root,
    h(
      'section',
      { class: 'hero' },
      h('h1', { class: 'hero-title' }, TAGLINE),
      h('p', { class: 'hero-sub' }, SUBTITLE),
      dropzone({ onFiles: showStaged, paste: true, folders: false, title: 'DROP FILES HERE', subtitle: 'or' }),
      h('p', { class: 'privacy-line' }, icon('lock'), PRIVACY_TEXT),
      privacyBadges(),
    ),
    filesPanel,
    h('section', { class: 'section', 'aria-labelledby': 'cat-h' }, h('div', { class: 'section-head' }, h('h2', { id: 'cat-h' }, 'Categories')), categoryChips()),
    recentSection,
    h('section', { class: 'section', 'aria-labelledby': 'pop-h' }, h('div', { class: 'section-head' }, h('h2', { id: 'pop-h' }, icon('star'), 'Popular tools'), h('a', { href: routeHref.tools(), class: 'link-more' }, 'All tools', icon('right'))), toolGrid(popularTools().slice(0, 12), { label: 'Popular tools' })),
    h(
      'section',
      { class: 'section', 'aria-labelledby': 'all-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'all-h' }, icon('grid'), 'All tools')),
      ...CATEGORIES.map((c) =>
        h('div', { class: 'category-block' }, h('h3', { class: 'category-title' }, h('a', { href: routeHref.category(c.id) }, icon(c.icon), c.name)), toolGrid(toolsInCategory(c.id), { label: `${c.name} tools` })),
      ),
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
