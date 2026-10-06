import { h } from '../utils/dom';
import { dialog, type DialogHandle } from './dialog';
import { getSettings, updateSettings, type ThemePref } from '../services/settings';
import { segmented, checkbox, button, notice } from './ui';
import { clearHistory } from '../services/history';
import { supportsSavePicker } from '../services/download';
import { toast } from './toast';
import { getLang, LANG_NAMES, LANGS, t } from '../i18n/i18n';
import { routeHref } from '../services/router';

let instance: DialogHandle | null = null;

function create(): DialogHandle {
  const s = getSettings();
  const theme = segmented<ThemePref>(
    t('Theme'),
    [
      { value: 'system', label: t('System'), icon: 'monitor' },
      { value: 'light', label: t('Light'), icon: 'sun' },
      { value: 'dark', label: t('Dark'), icon: 'moon' },
    ],
    s.theme,
    (v) => updateSettings({ theme: v }),
  );
  const hist = checkbox(t('Remember recently used tools and their settings (stored only on this device)'), s.history, (v) => updateSettings({ history: v }));
  const picker = checkbox(t('Ask where to save files (File System Access API)'), s.savePicker, (v) => updateSettings({ savePicker: v }));
  if (!supportsSavePicker()) {
    picker.input.disabled = true;
    picker.el.classList.add('is-disabled');
  }

  const body = h(
    'div',
    { class: 'settings-body' },
    theme.el,
    h('fieldset', { class: 'field fieldset' }, h('legend', null, t('Language')),
      h('div', { class: 'segmented' }, ...LANGS.map((l) => h('a', { class: 'seg', href: routeHref.inLang(l), dataset: { langLink: l }, hreflang: l, lang: l, 'aria-current': l === getLang() ? 'true' : undefined }, LANG_NAMES[l]))),
    ),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('Privacy')), hist.el),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('Saving')), picker.el, !supportsSavePicker() ? h('p', { class: 'hint' }, t('Not supported in this browser — files are saved with a regular download.')) : null),
    button(t('Clear history & saved tool settings'), {
      variant: 'danger',
      icon: 'trash',
      onClick: async () => {
        await clearHistory();
        toast(t('History cleared'), 'success');
      },
    }),
    notice('info', h('strong', null, t('Your files never leave your device.')), ' ', t('Everything is processed locally in your browser. History contains only tool names, dates and options — never files or file names.')),
  );
  return dialog(t('Settings'), body, { class: 'dialog-settings' });
}

export function openSettings(): void {
  instance ??= create();
  instance.open();
}
