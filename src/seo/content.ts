/**
 * SEO text shared by the client (tool pages) and the build-time static page
 * generator. Pure data/strings only — no DOM.
 */
import type { FaqItem, ToolMeta } from '../tools/types.ts';
import { APP_NAME } from '../config.ts';
import { TOOLS, categoryById } from '../tools/catalog.ts';

export function toolTitle(t: ToolMeta): string {
  return `${t.title ?? `${t.name} — Free Online, Private, No Upload`} | ${APP_NAME}`;
}

export function toolDescription(t: ToolMeta): string {
  return t.metaDescription ?? `${t.description} Free, works offline, files never leave your device.`;
}

export function toolAbout(t: ToolMeta): string {
  if (t.about) return t.about;
  const base = t.variantOf ? TOOLS.find((x) => x.id === t.variantOf) : undefined;
  return `${t.description} ${base?.about ?? ''}`.trim();
}

export function toolFaq(t: ToolMeta): FaqItem[] {
  const base = t.variantOf ? TOOLS.find((x) => x.id === t.variantOf) : undefined;
  const specific = t.faq ?? base?.faq ?? [];
  const usesFiles = t.supportedFormats.length > 0;
  const generic: FaqItem[] = [
    {
      q: usesFiles ? 'Are my files uploaded to a server?' : 'Is my data sent to a server?',
      a: usesFiles
        ? 'No. Your files are processed locally in your browser and are not uploaded to our server. The site is a static web app without a backend; processing uses JavaScript, Web Workers and WebAssembly on your device.'
        : 'No. Everything runs locally in your browser; nothing you type is sent anywhere.',
    },
    {
      q: `Is the ${t.name} free?`,
      a: 'Yes. All tools are free, without registration, watermarks or limits beyond what your device can handle.',
    },
    {
      q: 'Does it work offline and on mobile?',
      a: 'Yes. After your first visit the app is cached, so most tools also work without an internet connection. It runs in modern browsers on Windows, macOS, Linux, Android and iOS, and can be installed as an app (PWA).',
    },
  ];
  return [...specific, ...generic];
}

export function howToSteps(t: ToolMeta): string[] {
  if (!t.supportedFormats.length) return ['Enter or paste your input.', 'Adjust the options.', 'Copy or download the result.'];
  const multi = t.batch ? 'one or more files' : 'a file';
  return [
    `Drop ${multi} onto the upload area or tap “Choose Files”.`,
    'Adjust the options — a preview updates instantly.',
    t.batch ? 'Download each result or use “Download All” to get a ZIP.' : 'Download or copy the result.',
  ];
}

export function relatedTools(t: ToolMeta, n = 6): ToolMeta[] {
  const sameCat = TOOLS.filter((x) => x.id !== t.id && x.category === t.category && !x.variantOf);
  const base = t.variantOf ? TOOLS.find((x) => x.id === t.variantOf) : undefined;
  const list = base ? [base, ...sameCat.filter((x) => x.id !== base.id)] : sameCat;
  return list.slice(0, n);
}

export const categoryName = (id: string): string => categoryById(id)?.name ?? id;
