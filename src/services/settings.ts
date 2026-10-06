/**
 * App-wide preferences, stored in localStorage (synchronous, tiny).
 */
export type ThemePref = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePref;
  /** Keep a local list of recently used tools + their settings. */
  history: boolean;
  /** Use the File System Access API "Save as" dialog where supported. */
  savePicker: boolean;
}

const KEY = 'uft-settings';
const DEFAULTS: AppSettings = { theme: 'system', history: true, savePicker: false };

type Listener = (s: AppSettings) => void;
const listeners = new Set<Listener>();

function read(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}

let current = read();

export const getSettings = (): AppSettings => current;

export function updateSettings(patch: Partial<AppSettings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(current));
}

export function onSettingsChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
