import { describe, expect, it } from 'vitest';
import { TOOLS, CATEGORIES } from '../src/tools/catalog';
import { missingModules } from '../src/tools/registry';
import { searchTools } from '../src/services/search';
import { suggestTools } from '../src/services/suggest';

describe('tool catalog / registry', () => {
  it('every tool points to an existing module', () => {
    expect(missingModules()).toEqual([]);
  });
  it('has unique, URL-safe ids', () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('contains all required SEO routes', () => {
    const required = ['image-compressor', 'image-converter', 'image-resizer', 'png-to-webp', 'jpg-to-webp', 'pdf-merge', 'pdf-split', 'json-formatter', 'csv-to-json', 'base64', 'zip', 'favicon-generator'];
    for (const id of required) expect(TOOLS.find((t) => t.id === id), id).toBeTruthy();
  });
  it('every tool belongs to a known category and variants point to real tools', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const t of TOOLS) {
      expect(cats.has(t.category)).toBe(true);
      if (t.variantOf) expect(TOOLS.find((x) => x.id === t.variantOf)).toBeTruthy();
    }
  });
});

describe('search', () => {
  it('"webp" finds converters, compressor and resizer variants', () => {
    const names = searchTools('webp', 30).map((t) => t.name);
    for (const n of ['JPG to WebP', 'PNG to WebP', 'Compress WebP', 'Resize WebP']) expect(names).toContain(n);
  });
  it('multi-word queries narrow results', () => {
    expect(searchTools('merge pdf')[0].id).toBe('pdf-merge');
    expect(searchTools('jpg to webp')[0].id).toBe('jpg-to-webp');
  });
  it('returns nothing for gibberish', () => {
    expect(searchTools('zzqqxx')).toEqual([]);
  });
});

describe('suggestions', () => {
  const f = (name: string) => new File([new Uint8Array(4)], name);
  it('suggests merge first for several PDFs', () => {
    expect(suggestTools([f('a.pdf'), f('b.pdf')])[0].id).toBe('pdf-merge');
  });
  it('suggests image tools for images and only batch tools for many files', () => {
    const s = suggestTools([f('a.jpg'), f('b.png')]);
    expect(s[0].id).toBe('image-compressor');
    expect(s.every((t) => t.batch)).toBe(true);
  });
  it('suggests unzip for a zip', () => {
    expect(suggestTools([f('x.zip')])[0].id).toBe('unzip');
  });
});
