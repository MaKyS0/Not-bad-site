/** Localized views of catalog metadata. Pure — used by the app and the build. */
import type { Category, ToolMeta } from '../tools/types.ts';
import { getLang, type Lang } from './i18n.ts';
import { CATEGORY_RU, TOOL_RU, converterRu } from './catalog.ru.ts';

const cache = new Map<string, ToolMeta>();

/** Tool metadata with name/description/about/FAQ/keywords in the given language. */
export function loc(tool: ToolMeta, lang: Lang = getLang()): ToolMeta {
  if (lang === 'en') return tool;
  const key = `${lang}:${tool.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const conv = /^([A-Za-z]+) to ([A-Za-z]+)$/.exec(tool.name);
  const base = tool.variantOf === 'image-converter' && conv ? converterRu(conv[1], conv[2]) : {};
  const ru = { ...base, ...TOOL_RU[tool.id] };
  const out: ToolMeta = {
    ...tool,
    name: ru.name ?? tool.name,
    description: ru.description ?? tool.description,
    about: ru.about ?? (ru.description ? undefined : tool.about),
    title: ru.title,
    metaDescription: undefined,
    faq: ru.faq ?? (tool.faq ? [] : undefined),
    // Search matches both languages.
    keywords: [...(tool.keywords ?? []), ...(ru.keywords ?? []), tool.name.toLowerCase()],
  };
  cache.set(key, out);
  return out;
}

export function locCategory(cat: Category, lang: Lang = getLang()): Category {
  if (lang === 'en') return cat;
  const ru = CATEGORY_RU[cat.id];
  return ru ? { ...cat, ...ru } : cat;
}
