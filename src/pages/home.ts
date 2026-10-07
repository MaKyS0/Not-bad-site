import { h, render, announce } from '../utils/dom';
import { dropzone } from '../components/dropzone';
import { directory, toolList } from '../components/toolCard';
import { icon } from '../components/icons';
import { CATEGORIES, toolById, primaryTools } from '../tools/catalog';
import { COMMON_TASKS } from '../tools/formats';
import { getHistory, onHistoryChange } from '../services/history';
import { suggestTools } from '../services/suggest';
import { handOver, getStaged, setStaged } from '../services/fileStore';
import { navigate, routeHref } from '../services/router';
import { formatBytes, formatRelative } from '../utils/format';
import { guessKind } from '../utils/fileType';
import { GITHUB_URL, SUBTITLE, TAGLINE } from '../config';
import { iconButton, button } from '../components/ui';
import { plural, t } from '../i18n/i18n';
import { loc } from '../i18n/localize';
import { countUp, enter, pop, reveal } from '../utils/motion';

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
          h('span', { class: `cat-dot cat-${kindToCat(guessKind(f))}`, 'aria-hidden': 'true' }),
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
            toolList(suggestions, {
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
    const wasHidden = filesPanel.hidden;
    filesPanel.hidden = false;
    if (wasHidden) pop(filesPanel, { y: 10 });
    enter(filesPanel.querySelectorAll('.file-chip, .tool-row'), { gap: 0.025, duration: 0.22 });
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
      { class: 'intro' },
      h(
        'div',
        { class: 'intro-text' },
        h('h1', null, t(TAGLINE)),
        h('p', { class: 'intro-sub' }, t(SUBTITLE)),
        h(
          'ul',
          { class: 'intro-facts', role: 'list' },
          h('li', null, h('b', null, String(primaryTools().length)), `${plural(primaryTools().length, 'tool').replace(/^\S+\s/, '')} ${t('in {n} categories', { n: CATEGORIES.length })}`),
          h('li', null, h('b', null, '0 B'), t('sent to any server')),
          h('li', null, h('b', null, 'PWA'), t('works offline')),
        ),
      ),
      dropzone({ onFiles: showStaged, paste: true, folders: false, title: t('Drop files here'), subtitle: t('or'), hint: t('Images, PDF, ZIP, CSV, JSON, text, audio — or any file'), global: true }),
    ),
    filesPanel,
    recentSection,
    h(
      'div',
      { class: 'home-split' },
      h('section', { 'aria-labelledby': 'common-h' },
        h('div', { class: 'section-head' }, h('h2', { id: 'common-h' }, t('Common tasks')), h('a', { href: routeHref.tools(), class: 'link-more' }, t('All tools'), icon('right'))),
        toolList(COMMON_TASKS.map((id) => toolById(id)).filter((x) => x !== undefined), { label: t('Common tasks') }),
      ),
      privacyNote(),
    ),
    h('section', { class: 'section', 'aria-labelledby': 'all-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'all-h' }, t('All tools'), h('span', { class: 'count' }, String(primaryTools().length)))),
      directory(),
    ),
  );
  // Entrance: headline and facts in sequence, then the drop zone, then the lists.
  const intro = root.querySelector('.intro')!;
  enter(intro.querySelectorAll('h1, .intro-sub, .intro-facts li'), { gap: 0.06 });
  pop(intro.querySelector('.dropzone'), { y: 10 });
  const count = intro.querySelector<HTMLElement>('.intro-facts b');
  if (count) countUp(count, primaryTools().length);
  enter(root.querySelectorAll('.home-split .tool-row'), { delay: 0.18, gap: 0.03 });
  enter(root.querySelector('.privacy-note'), { delay: 0.3, y: 10 });
  reveal(root, '.dir-group');
  if (getStaged().length) showStaged(getStaged());
  void drawRecent();
  return onHistoryChange(() => void drawRecent());
}

function privacyNote(): HTMLElement {
  return h(
    'aside',
    { class: 'privacy-note', 'aria-labelledby': 'privacy-h' },
    h('h2', { id: 'privacy-h' }, t('Where your files go')),
    h(
      'ul',
      null,
      h('li', null, t('Nowhere. Files are read by your browser and processed on this device with JavaScript and WebAssembly.')),
      h('li', null, t('The page’s security policy blocks connections to other servers, so a file can’t be sent even by mistake.')),
      h('li', null, t('After the first visit the tools also work offline.')),
    ),
    h('p', null, h('a', { href: GITHUB_URL, target: '_blank', rel: 'noopener noreferrer' }, t('Check the source code on GitHub'))),
  );
}

export function kindToCat(kind: string): string {
  return kind === 'zip' ? 'archive' : kind === 'other' || kind === 'video' ? 'files' : kind;
}
