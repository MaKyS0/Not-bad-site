/**
 * Tiny i18n layer.
 *
 * English source strings are the keys: `t('Choose Files')` returns the Russian
 * translation when the current language is Russian and falls back to the key
 * otherwise. Placeholders use `{name}` syntax. The current language comes from
 * the URL (/ru/… → Russian), so every page has a stable, indexable language.
 *
 * Pure module (no DOM) — also used by the build-time page generator.
 */
import { RU } from './ru.ts';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', ru: 'Русский' };
export const LANG_PREF_KEY = 'uft-lang';

let current: Lang = 'en';
export const getLang = (): Lang => current;
export const setLang = (l: Lang): void => {
  current = l;
};

/** URL prefix of a language ("" for English, "ru/" for Russian). */
export const langPrefix = (l: Lang = current): string => (l === 'en' ? '' : `${l}/`);

function fill(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Translate into an explicit language. */
export function tr(lang: Lang, key: string, params?: Record<string, string | number>): string {
  return fill(lang === 'ru' ? (RU[key] ?? key) : key, params);
}

/** Translate into the current language. */
export const t = (key: string, params?: Record<string, string | number>): string => tr(current, key, params);

/* ---------------- plurals ---------------- */

const NOUNS: Record<string, { en: [string, string]; ru: [string, string, string] }> = {
  file: { en: ['file', 'files'], ru: ['файл', 'файла', 'файлов'] },
  page: { en: ['page', 'pages'], ru: ['страница', 'страницы', 'страниц'] },
  image: { en: ['image', 'images'], ru: ['изображение', 'изображения', 'изображений'] },
  line: { en: ['line', 'lines'], ru: ['строка', 'строки', 'строк'] },
  row: { en: ['row', 'rows'], ru: ['строка', 'строки', 'строк'] },
  column: { en: ['column', 'columns'], ru: ['столбец', 'столбца', 'столбцов'] },
  character: { en: ['character', 'characters'], ru: ['символ', 'символа', 'символов'] },
  tool: { en: ['tool', 'tools'], ru: ['инструмент', 'инструмента', 'инструментов'] },
  folder: { en: ['folder', 'folders'], ru: ['папка', 'папки', 'папок'] },
  byte: { en: ['byte', 'bytes'], ru: ['байт', 'байта', 'байт'] },
  issue: { en: ['issue', 'issues'], ru: ['проблема', 'проблемы', 'проблем'] },
};

export function ruPluralIndex(n: number): 0 | 1 | 2 {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 2;
  if (b > 1 && b < 5) return 1;
  if (b === 1) return 0;
  return 2;
}

/** "3 files" / "3 файла". */
export function plural(n: number, noun: keyof typeof NOUNS | string, lang: Lang = current, withNumber = true): string {
  const forms = NOUNS[noun];
  const word = !forms ? noun : lang === 'ru' ? forms.ru[Number.isInteger(n) ? ruPluralIndex(n) : 1] : forms.en[n === 1 ? 0 : 1];
  return withNumber ? `${n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')} ${word}` : word;
}

/* ---------------- dynamic messages (errors from workers/libs) ---------------- */

let patterns: { re: RegExp; key: string; names: string[] }[] | null = null;

/**
 * Translate a message that was produced with interpolated values (e.g. an
 * error thrown in a worker) by matching it against templated dictionary keys.
 */
export function translateMessage(msg: string, lang: Lang = current): string {
  if (lang === 'en' || !msg) return msg;
  if (RU[msg]) return RU[msg];
  patterns ??= Object.keys(RU)
    .filter((k) => /\{\w+\}/.test(k))
    .map((key) => {
      const names: string[] = [];
      const src = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (m) {
            names.push(m[1]);
            return '([\\s\\S]+?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
      return { re: new RegExp(`^${src}$`), key, names };
    });
  for (const p of patterns) {
    const m = p.re.exec(msg);
    if (m) return fill(RU[p.key], Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
  }
  return msg;
}

/** Locale for Intl formatting. */
export const locale = (lang: Lang = current): string => (lang === 'ru' ? 'ru-RU' : 'en-US');
