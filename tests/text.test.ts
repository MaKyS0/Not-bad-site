import { describe, expect, it } from 'vitest';
import { caseOps, dedupeLines, reverseText, sortLines, textStats, trimText, splitWords } from '../src/tools/text/lib/text';
import { base64ToBytes, decodeBase64Text, encodeBase64Text, htmlDecode, htmlEncode, urlDecode, urlEncode } from '../src/tools/text/lib/codec';

describe('text stats', () => {
  it('counts words, characters (graphemes), lines, sentences', () => {
    const s = textStats('Hello world! Привет, мир.\n\nSecond 👍🏽 paragraph?');
    expect(s.words).toBe(6);
    expect(s.lines).toBe(3);
    expect(s.nonEmptyLines).toBe(2);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(textStats('👍🏽').characters).toBe(1);
    expect(textStats('').words).toBe(0);
  });
});

describe('case conversion', () => {
  it('converts identifiers', () => {
    expect(splitWords('helloWorld HTTPServer foo_bar')).toEqual(['hello', 'World', 'HTTP', 'Server', 'foo', 'bar']);
    expect(caseOps.camel('Hello big world')).toBe('helloBigWorld');
    expect(caseOps.pascal('hello big world')).toBe('HelloBigWorld');
    expect(caseOps.snake('helloBigWorld')).toBe('hello_big_world');
    expect(caseOps.kebab('Hello Big World')).toBe('hello-big-world');
    expect(caseOps.constant('hello world')).toBe('HELLO_WORLD');
    expect(caseOps.title('the quick brown fox')).toBe('The Quick Brown Fox');
    expect(caseOps.sentence('HELLO. how ARE you')).toBe('Hello. How are you');
  });
});

describe('line ops', () => {
  it('dedupes with options', () => {
    expect(dedupeLines('a\nA\nb\na').text).toBe('a\nA\nb');
    expect(dedupeLines('a\nA\nb\n a', { ignoreCase: true, trim: true })).toEqual({ text: 'a\nb', removed: 2 });
  });
  it('sorts', () => {
    expect(sortLines('b\na\nC', 'asc')).toBe('a\nb\nC');
    expect(sortLines('item10\nitem2\nitem1', 'natural')).toBe('item1\nitem2\nitem10');
    expect(sortLines('ccc\na\nbb', 'length')).toBe('a\nbb\nccc');
    expect(sortLines('1\n2\n3', 'reverse')).toBe('3\n2\n1');
    expect(sortLines('1\n2\n3\n4', 'shuffle').split('\n').sort()).toEqual(['1', '2', '3', '4']);
  });
  it('reverses unicode safely and trims', () => {
    expect(reverseText('ab👍🏽c')).toBe('c👍🏽ba');
    expect(trimText('  a   b  \n\n c ', { trimLines: true, collapseSpaces: true, removeEmptyLines: true })).toBe('a b\nc');
  });
});

describe('codecs', () => {
  it('base64 round-trips UTF-8 and URL-safe variant', () => {
    const s = 'Привет, 世界 👋';
    expect(decodeBase64Text(encodeBase64Text(s))).toBe(s);
    const url = encodeBase64Text('??>>', { urlSafe: true });
    expect(url).not.toMatch(/[+/=]/);
    expect(decodeBase64Text(url)).toBe('??>>');
    expect(Array.from(base64ToBytes('data:image/png;base64,AAEC'))).toEqual([0, 1, 2]);
    expect(() => base64ToBytes('not base64!')).toThrow();
  });
  it('url encode/decode', () => {
    expect(urlEncode('a b&c=d/é')).toBe('a%20b%26c%3Dd%2F%C3%A9');
    expect(urlEncode('https://x.y/a b?q=1', 'uri')).toBe('https://x.y/a%20b?q=1');
    expect(urlDecode('a+b%20c')).toBe('a b c');
    expect(() => urlDecode('%E0%A4%A')).toThrow();
  });
  it('html entities', () => {
    expect(htmlEncode('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    expect(htmlEncode('é', 'nonascii')).toBe('&#xE9;');
    expect(htmlDecode('&lt;b&gt; &amp; &copy; &#x41; &#66;')).toBe('<b> & © A B');
  });
});
