import { getSettings, onSettingsChange, type ThemePref } from './settings';

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function resolvedTheme(pref: ThemePref = getSettings().theme): 'light' | 'dark' {
  if (pref === 'system') return media?.matches ? 'dark' : 'light';
  return pref;
}

function apply(): void {
  const pref = getSettings().theme;
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme(pref);
  root.dataset.themePref = pref;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  meta?.setAttribute('content', resolvedTheme(pref) === 'dark' ? '#0b0f17' : '#ffffff');
}

export function initTheme(): void {
  apply();
  onSettingsChange(apply);
  media?.addEventListener?.('change', apply);
}
