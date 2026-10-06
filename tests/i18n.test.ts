import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RU } from '../src/i18n/ru';
import { plural, translateMessage, tr, ruPluralIndex } from '../src/i18n/i18n';
import { loc, locCategory } from '../src/i18n/localize';
import { TOOLS, CATEGORIES } from '../src/tools/catalog';
import { toolFaq, toolTitle } from '../src/seo/content';
import { searchTools } from '../src/services/search';
import { setLang } from '../src/i18n/i18n';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Terms that are the same in Russian (codes, formats, brand names). */
const SAME = new Set(['UTF-8', 'UTF-16 LE', 'UTF-16 BE', 'KOI8-R', 'ISO-8859-15', 'Windows-1250', 'Shift_JIS', 'EUC-KR', 'GBK', 'Big5', 'EXIF', 'GPS', 'IPTC', 'XMP', 'JFIF', '72 dpi', '150 dpi', '200 dpi', '300 dpi', 'Letter', 'Legal', 'Tabloid']);

describe('i18n', () => {
  it('every t()/tr() key used in the source has a Russian translation', () => {
    const missing: string[] = [];
    for (const file of walk('src')) {
      if (file.includes('i18n/ru.ts')) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\b(?:t\(|tr\(lang,\s*)'((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1].replace(/\\'/g, "'");
        if (!(key in RU) && !SAME.has(key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps placeholders intact in translations', () => {
    for (const [en, ru] of Object.entries(RU)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(ru), en).toBe(ph(en));
    }
  });

  it('pluralises Russian nouns', () => {
    expect([1, 2, 5, 11, 21, 22, 25, 111].map(ruPluralIndex)).toEqual([0, 1, 2, 2, 0, 1, 2, 2]);
    expect(plural(1, 'file', 'ru')).toBe('1 файл');
    expect(plural(3, 'file', 'ru')).toBe('3 файла');
    expect(plural(12, 'page', 'ru')).toBe('12 страниц');
    expect(plural(1, 'file', 'en')).toBe('1 file');
    expect(plural(2, 'file', 'en')).toBe('2 files');
  });

  it('translates dynamic error messages by pattern', () => {
    expect(translateMessage('“report.pdf” is encrypted or password-protected.', 'ru')).toBe('«report.pdf» зашифрован или защищён паролем.');
    expect(translateMessage('Page range “9-12” is outside the document (1–5).', 'ru')).toBe('Диапазон «9-12» выходит за пределы документа (1–5).');
    expect(translateMessage('Not in dictionary', 'ru')).toBe('Not in dictionary');
    expect(translateMessage('Something went wrong.', 'en')).toBe('Something went wrong.');
    expect(tr('ru', 'Download {name}', { name: 'a.png' })).toBe('Скачать a.png');
  });

  it('localizes every tool and category', () => {
    for (const t of TOOLS) {
      const l = loc(t, 'ru');
      expect(/[а-яё]/i.test(l.name) || / в /.test(l.name), `${t.id} name`).toBe(true);
      expect(/[а-яё]/i.test(l.description), `${t.id} description`).toBe(true);
      expect(/[а-яё]/i.test(toolTitle(t, 'ru')) || / в /.test(toolTitle(t, 'ru')), `${t.id} title`).toBe(true);
      for (const f of toolFaq(t, 'ru')) expect(/[а-яё]/i.test(f.q + f.a), `${t.id} FAQ`).toBe(true);
    }
    for (const c of CATEGORIES) expect(/[а-яё]/i.test(locCategory(c, 'ru').name + locCategory(c, 'ru').description)).toBe(true);
    expect(loc(TOOLS.find((x) => x.id === 'png-to-webp')!, 'ru').name).toBe('PNG в WebP');
  });

  it('search finds tools by Russian words', () => {
    setLang('ru');
    expect(searchTools('объединить')[0].id).toBe('pdf-merge');
    expect(searchTools('сжать').map((t) => t.id)).toContain('image-compressor');
    expect(searchTools('webp').map((t) => t.id)).toContain('png-to-webp');
    setLang('en');
  });
});
