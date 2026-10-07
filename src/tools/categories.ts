import type { Category } from './types.ts';

export const CATEGORIES: Category[] = [
  { id: 'image', name: 'Image', icon: 'image', description: 'Compress, convert, resize, crop and rotate images.' },
  { id: 'pdf', name: 'PDF', icon: 'pdf', description: 'Merge, split, rotate and convert PDF documents.' },
  { id: 'files', name: 'Files', icon: 'file', description: 'Check files for viruses, inspect any file, compute SHA-256 hashes.' },
  { id: 'data', name: 'Data', icon: 'data', description: 'Format and convert JSON, CSV and XML.' },
  { id: 'text', name: 'Text', icon: 'text', description: 'Count, clean, sort, transform and encode text.' },
  { id: 'archive', name: 'Archive', icon: 'archive', description: 'Create, edit and extract ZIP archives.' },
  { id: 'audio', name: 'Audio', icon: 'audio', description: 'Inspect, trim and convert MP3, WAV and OGG.' },
  { id: 'developer', name: 'Developer', icon: 'code', description: 'UUIDs, hashes, JWT decoding and data URIs.' },
];

export const categoryById = (id: string): Category | undefined => CATEGORIES.find((c) => c.id === id);
