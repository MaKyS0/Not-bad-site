import { describe, expect, it } from 'vitest';
import { formatJson, jsonToRows, flatten, parseJson, tokenizeJson, findJsonErrorOffset } from '../src/tools/data/lib/json';
import { formatXml, minifyXml, tokenizeXml } from '../src/tools/data/lib/xml';
import { markdownToHtml } from '../src/tools/data/lib/markdown';

describe('json', () => {
  it('formats, minifies and sorts keys', () => {
    expect(formatJson('{"b":1,"a":[1,2]}', { indent: 2 })).toBe('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(formatJson('{ "b" : 1 , "a" : 2 }', { indent: 2, minify: true })).toBe('{"b":1,"a":2}');
    expect(formatJson('{"b":{"d":1,"c":2},"a":0}', { indent: 0, sortKeys: true, minify: true })).toBe('{"a":0,"b":{"c":2,"d":1}}');
  });
  it('reports error line and column', () => {
    try {
      parseJson('{\n  "a": 1,\n  "b": }');
      throw new Error('should fail');
    } catch (e) {
      expect((e as Error).message).toMatch(/line 3, column/);
    }
    expect(() => parseJson('')).toThrow(/empty/);
  });
  it('locates errors precisely', () => {
    expect(findJsonErrorOffset('{"a":1}').pos).toBe(-1);
    expect(findJsonErrorOffset('[1,2,]')).toEqual({ pos: 5, reason: 'Unexpected character "]"' });
    expect(findJsonErrorOffset("{'a':1}").pos).toBe(1);
    expect(findJsonErrorOffset('{"a":1} x').reason).toMatch(/after/);
    expect(findJsonErrorOffset('"a\\n\\u00e9\\""').pos).toBe(-1);
    expect(findJsonErrorOffset('"\\x"')).toEqual({ pos: 1, reason: 'Invalid escape sequence' });
    expect(findJsonErrorOffset('"\\u12"').reason).toBe('Invalid \\u escape');
    expect(findJsonErrorOffset('"abc').reason).toMatch(/Unterminated/);
    expect(findJsonErrorOffset('{"a": tru}').pos).toBe(6);
  });
  it('flattens and converts to rows', () => {
    expect(flatten({ a: { b: 1, c: [1, 2] }, d: null })).toEqual({ 'a.b': 1, 'a.c': '1; 2', d: null });
    const r = jsonToRows([{ name: 'A', addr: { city: 'X' } }, { name: 'B', age: 3 }]);
    expect(r.fields).toEqual(['name', 'addr.city', 'age']);
    expect(r.rows).toEqual([['A', 'X', undefined], ['B', undefined, 3]]);
    expect(jsonToRows([['h1', 'h2'], [1, 2]])).toEqual({ fields: ['h1', 'h2'], rows: [[1, 2]] });
    expect(jsonToRows({ items: [{ a: 1 }] }).rows).toEqual([[1]]);
    expect(() => jsonToRows(5)).toThrow();
  });
  it('tokenizes for highlighting', () => {
    const toks = tokenizeJson('{"k": "v", "n": -1.5e3, "b": true, "z": null}');
    expect(toks.filter(([t]) => t !== 'ws' && t !== 'punc')).toEqual([
      ['key', '"k"'], ['str', '"v"'], ['key', '"n"'], ['num', '-1.5e3'], ['key', '"b"'], ['bool', 'true'], ['key', '"z"'], ['null', 'null'],
    ]);
  });
});

describe('xml', () => {
  const src = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x "y">]><r a="1>2"><!-- c --><b>text</b><c/><d><![CDATA[<raw>]]></d></r>';
  it('tokenizes tricky constructs', () => {
    const kinds = tokenizeXml(src).map((t) => t.t);
    expect(kinds).toEqual(['pi', 'doctype', 'open', 'comment', 'open', 'text', 'close', 'self', 'open', 'cdata', 'close', 'close']);
  });
  it('formats and minifies without changing content', () => {
    const f = formatXml(src);
    expect(f).toBe('<?xml version="1.0"?>\n<!DOCTYPE r [<!ENTITY x "y">]>\n<r a="1>2">\n  <!-- c -->\n  <b>text</b>\n  <c/>\n  <d>\n    <![CDATA[<raw>]]>\n  </d>\n</r>');
    expect(minifyXml(f)).toBe(src);
    expect(minifyXml(f, true)).not.toContain('<!--');
  });
});

describe('markdown (safe)', () => {
  it('renders common syntax', () => {
    const html = markdownToHtml('# Title\n\nSome **bold** and *it* and `code`.\n\n- [x] done\n- item\n\n1. one\n2. two\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n```js\nlet x = 1 < 2;\n```');
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<input type="checkbox" disabled checked>');
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>');
    expect(html).toContain('<td style="text-align:right">2</td>');
    expect(html).toContain('let x = 1 &lt; 2;');
  });
  it('never emits raw HTML or dangerous links', () => {
    const html = markdownToHtml('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) [y](data:text/html,1) ![i](javascript:1) [ok](https://example.com)');
    expect(html).not.toMatch(/<script|<img|<[^>]*\son\w+=|href="(javascript|data):/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('href="https://example.com"');
  });
});

describe('markdown link safety', () => {
  it('rejects scripts hidden behind control characters and keeps tags intact', async () => {
    const { markdownToHtml } = await import('../src/tools/data/lib/markdown');
    for (const evil of ['\u0001javascript:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '\u0000javascript:x']) {
      const html = markdownToHtml(`[click](${evil})`);
      expect(html, evil).not.toMatch(/href/);
    }
    const html = markdownToHtml('[x](http://a/*) foo*');
    expect(html).toContain('href="http://a/*"');
    expect(html).toContain('target="_blank"');
    expect(markdownToHtml('[x](//evil.com)')).toContain('rel="noopener noreferrer"');
    expect(markdownToHtml('**bold [*link*](https://e.com)**')).toBe('<p><strong>bold <a href="https://e.com" target="_blank" rel="noopener noreferrer"><em>link</em></a></strong></p>');
  });
});
