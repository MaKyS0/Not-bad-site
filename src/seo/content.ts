/**
 * SEO text shared by the client (tool pages) and the build-time static page
 * generator. Pure data/strings only — no DOM.
 */
import type { FaqItem, ToolMeta } from '../tools/types.ts';
import { APP_NAME } from '../config.ts';
import { TOOLS, categoryById } from '../tools/catalog.ts';
import { getLang, tr, type Lang } from '../i18n/i18n.ts';
import { loc, locCategory } from '../i18n/localize.ts';

const baseOf = (t: ToolMeta, lang: Lang): ToolMeta | undefined => {
  const b = t.variantOf ? TOOLS.find((x) => x.id === t.variantOf) : undefined;
  return b ? loc(b, lang) : undefined;
};

export function toolTitle(t: ToolMeta, lang: Lang = getLang()): string {
  const l = loc(t, lang);
  return `${l.title ?? `${l.name} — ${tr(lang, 'Free Online, Private, No Upload')}`} | ${APP_NAME}`;
}

export function toolDescription(t: ToolMeta, lang: Lang = getLang()): string {
  const l = loc(t, lang);
  return l.metaDescription ?? `${l.description} ${tr(lang, 'Free, works offline, files never leave your device.')}`;
}

export function toolAbout(t: ToolMeta, lang: Lang = getLang()): string {
  const l = loc(t, lang);
  if (l.about) return l.about;
  return `${l.description} ${baseOf(t, lang)?.about ?? ''}`.trim();
}

export function toolFaq(t: ToolMeta, lang: Lang = getLang()): FaqItem[] {
  const l = loc(t, lang);
  const specific = l.faq ?? baseOf(t, lang)?.faq ?? [];
  const usesFiles = t.supportedFormats.length > 0;
  const generic: FaqItem[] = [
    {
      q: tr(lang, usesFiles ? 'Are my files uploaded to a server?' : 'Is my data sent to a server?'),
      a: tr(
        lang,
        usesFiles
          ? 'No. Your files are processed locally in your browser and are not uploaded to our server. The site is a static web app without a backend; processing uses JavaScript, Web Workers and WebAssembly on your device.'
          : 'No. Everything runs locally in your browser; nothing you type is sent anywhere.',
      ),
    },
    { q: tr(lang, 'Is the {name} free?', { name: l.name }), a: tr(lang, 'Yes. All tools are free, without registration, watermarks or limits beyond what your device can handle.') },
    {
      q: tr(lang, 'Does it work offline and on mobile?'),
      a: tr(lang, 'Yes. After your first visit the app is cached, so most tools also work without an internet connection. It runs in modern browsers on Windows, macOS, Linux, Android and iOS, and can be installed as an app (PWA).'),
    },
  ];
  return [...specific, ...generic];
}

export function howToSteps(t: ToolMeta, lang: Lang = getLang()): string[] {
  if (!t.supportedFormats.length) return [tr(lang, 'Enter or paste your input.'), tr(lang, 'Adjust the options.'), tr(lang, 'Copy or download the result.')];
  return [
    tr(lang, t.batch ? 'Drop one or more files onto the upload area or tap “Choose Files”.' : 'Drop a file onto the upload area or tap “Choose Files”.'),
    tr(lang, 'Adjust the options — a preview updates instantly.'),
    tr(lang, t.batch ? 'Download each result or use “Download All” to get a ZIP.' : 'Download or copy the result.'),
  ];
}

export function relatedTools(t: ToolMeta, n = 6): ToolMeta[] {
  const sameCat = TOOLS.filter((x) => x.id !== t.id && x.category === t.category && !x.variantOf);
  const base = t.variantOf ? TOOLS.find((x) => x.id === t.variantOf) : undefined;
  const list = base ? [base, ...sameCat.filter((x) => x.id !== base.id)] : sameCat;
  return list.slice(0, n);
}

export const categoryName = (id: string, lang: Lang = getLang()): string => {
  const c = categoryById(id);
  return c ? locCategory(c, lang).name : id;
};
