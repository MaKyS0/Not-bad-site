import { locale, t } from '../i18n/i18n';
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} ${t('B')}`;
  const units = [t('KB'), t('MB'), t('GB'), t('TB')];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : decimals)} ${units[i]}`;
}

/** Percentage change from `before` to `after`, e.g. -42.3 */
export function percentChange(before: number, after: number): number {
  if (before === 0) return 0;
  return ((after - before) / before) * 100;
}

export function formatPercent(p: number): string {
  const sign = p > 0 ? '+' : p < 0 ? '−' : '';
  return `${sign}${Math.abs(p).toFixed(1)} %`;
}

export function formatDate(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  if (diff < min) return t('just now');
  if (diff < 60 * min) return t('{n} min ago', { n: Math.floor(diff / min) });
  if (diff < 24 * 60 * min) return t('{n} h ago', { n: Math.floor(diff / (60 * min)) });
  const days = Math.floor(diff / (24 * 60 * min));
  if (days < 30) return t('{n} d ago', { n: days });
  return new Date(ts).toLocaleDateString(locale());
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const sign = seconds < 0 ? '-' : '';
  const s = Math.abs(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const secStr = sec.toFixed(sec < 10 && h === 0 && m === 0 ? 2 : 1).padStart(4, '0');
  return h > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}:${secStr.padStart(4, '0')}` : `${sign}${m}:${secStr}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString(locale());
}

/** File name helpers */
export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : '';
}

export function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function withExt(name: string, ext: string): string {
  return `${baseName(name)}.${ext}`;
}

/** Make a name unique within `used` by appending (2), (3)… */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const b = baseName(name);
  const e = extOf(name);
  for (let i = 2; ; i++) {
    const candidate = e ? `${b} (${i}).${e}` : `${b} (${i})`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

/** Invisible bidi controls (e.g. U+202E) can disguise "gpj.exe" as "exe.jpg". */
export const BIDI_CHARS = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g;
export const stripBidi = (s: string): string => s.replace(BIDI_CHARS, '');

/** Strip characters that are invalid in file names on common OSes. */
export function safeFileName(name: string, fallback = 'file'): string {
  const cleaned = stripBidi(name).replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_').replace(/^\.+/, '').trim();
  return cleaned.slice(0, 200) || fallback;
}
