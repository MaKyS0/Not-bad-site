import { h } from '../utils/dom';
import { dialog, type DialogHandle } from './dialog';
import { getSettings, updateSettings, type ThemePref } from '../services/settings';
import { segmented, checkbox, button, notice } from './ui';
import { clearHistory } from '../services/history';
import { supportsSavePicker } from '../services/download';
import { toast } from './toast';

let instance: DialogHandle | null = null;

function create(): DialogHandle {
  const s = getSettings();
  const theme = segmented<ThemePref>(
    'Theme',
    [
      { value: 'system', label: 'System', icon: 'monitor' },
      { value: 'light', label: 'Light', icon: 'sun' },
      { value: 'dark', label: 'Dark', icon: 'moon' },
    ],
    s.theme,
    (v) => updateSettings({ theme: v }),
  );
  const hist = checkbox('Remember recently used tools and their settings (stored only on this device)', s.history, (v) => updateSettings({ history: v }));
  const picker = checkbox('Ask where to save files (File System Access API)', s.savePicker, (v) => updateSettings({ savePicker: v }));
  if (!supportsSavePicker()) {
    picker.input.disabled = true;
    picker.el.classList.add('is-disabled');
  }

  const body = h(
    'div',
    { class: 'settings-body' },
    theme.el,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Privacy'), hist.el),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Saving'), picker.el, !supportsSavePicker() ? h('p', { class: 'hint' }, 'Not supported in this browser — files are saved with a regular download.') : null),
    button('Clear history & saved tool settings', {
      variant: 'danger',
      icon: 'trash',
      onClick: async () => {
        await clearHistory();
        toast('History cleared', 'success');
      },
    }),
    notice('info', h('strong', null, 'Your files never leave your device. '), 'Everything is processed locally in your browser. History contains only tool names, dates and options — never files or file names.'),
  );
  return dialog('Settings', body, { class: 'dialog-settings' });
}

export function openSettings(): void {
  instance ??= create();
  instance.open();
}
