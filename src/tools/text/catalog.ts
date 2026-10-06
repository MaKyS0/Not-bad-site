import type { ToolMeta } from '../types';

const TEXT_FILES = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'log', 'tsv'];

const transform = (id: string, name: string, op: string, description: string, keywords: string[], extra: Partial<ToolMeta> = {}): ToolMeta => ({
  id,
  name,
  category: 'text',
  description,
  supportedFormats: TEXT_FILES,
  icon: 'text',
  component: 'text/transform',
  preset: { op },
  keywords,
  ...extra,
});

export const textTools: ToolMeta[] = [
  {
    id: 'word-counter',
    name: 'Word Counter',
    category: 'text',
    description: 'Count words, characters, lines, sentences and reading time.',
    about: 'Live statistics for any text: words, characters with and without spaces, lines, sentences, paragraphs, unique words, estimated reading and speaking time, and the most frequent words. Works with all languages and emoji (counted as one character).',
    supportedFormats: TEXT_FILES,
    icon: 'count',
    component: 'text/counter',
    keywords: ['word count', 'character count', 'letters', 'lines', 'sentences', 'reading time', 'counter'],
    popular: true,
  },
  {
    id: 'character-counter', name: 'Character Counter', category: 'text', variantOf: 'word-counter',
    description: 'Count characters with and without spaces, including emoji.',
    supportedFormats: TEXT_FILES, icon: 'count', component: 'text/counter', preset: { focus: 'characters' },
    keywords: ['character count', 'letters', 'chars', 'twitter limit'],
  },
  {
    id: 'line-counter', name: 'Line Counter', category: 'text', variantOf: 'word-counter',
    description: 'Count total, empty and non-empty lines of text or a file.',
    supportedFormats: TEXT_FILES, icon: 'count', component: 'text/counter', preset: { focus: 'lines' },
    keywords: ['line count', 'lines', 'rows'],
  },
  transform('remove-duplicate-lines', 'Remove Duplicate Lines', 'dedupe', 'Delete repeated lines, optionally ignoring case and whitespace.', ['duplicate', 'dedupe', 'unique', 'lines'], { popular: true }),
  transform('sort-lines', 'Sort Lines', 'sort-asc', 'Sort lines alphabetically, naturally, by length, or shuffle them.', ['sort', 'alphabetical', 'order', 'lines', 'natural sort']),
  transform('reverse-text', 'Reverse Text', 'reverse', 'Reverse characters, words or line order — Unicode safe.', ['reverse', 'backwards', 'mirror text', 'flip']),
  transform('case-converter', 'Case Converter', 'upper', 'UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case and more.', ['case', 'uppercase', 'lowercase', 'title case', 'camelcase', 'snake case', 'kebab']),
  transform('trim-spaces', 'Trim Spaces', 'trim', 'Trim lines, collapse repeated spaces and remove empty lines.', ['trim', 'whitespace', 'spaces', 'clean', 'empty lines']),
  {
    id: 'base64',
    name: 'Base64 Encoder / Decoder',
    category: 'text',
    description: 'Encode text or files to Base64 and decode Base64 back — UTF-8 safe.',
    about: 'Encode text (UTF-8) or any file to Base64 or Base64URL, and decode Base64 back to text or to a downloadable file. Data-URI prefixes are handled automatically.',
    supportedFormats: ['*'],
    icon: 'code',
    component: 'text/encoder',
    preset: { codec: 'base64' },
    keywords: ['base64', 'encode', 'decode', 'b64', 'data uri', 'base64url'],
    popular: true,
  },
  {
    id: 'url-encoder', name: 'URL Encoder / Decoder', category: 'text',
    description: 'Percent-encode text for URLs or decode %XX sequences.',
    supportedFormats: TEXT_FILES, icon: 'link', component: 'text/encoder', preset: { codec: 'url' },
    keywords: ['url', 'encode', 'decode', 'percent', 'uri', 'escape', 'query string'],
  },
  {
    id: 'html-entities', name: 'HTML Entity Encoder / Decoder', category: 'text',
    description: 'Escape special characters as HTML entities or decode them.',
    supportedFormats: TEXT_FILES, icon: 'code', component: 'text/encoder', preset: { codec: 'html' },
    keywords: ['html', 'entities', 'escape', 'unescape', '&amp;', 'encode', 'decode'],
  },
];
