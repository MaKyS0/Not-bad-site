import type { ToolMeta } from '../types.ts';

export const fileTools: ToolMeta[] = [
  {
    id: 'file-inspector',
    name: 'File Inspector',
    category: 'files',
    description: 'Name, type, size, dates, dimensions, pages and SHA-256 of any file.',
    about: 'Drop any file to see its name, extension, declared MIME type and the type detected from the file’s actual bytes (magic numbers), size, last-modified date, image dimensions, PDF page count, audio duration and a SHA-256 checksum.',
    supportedFormats: ['*'],
    icon: 'search-file',
    component: 'files/inspector',
    keywords: ['file info', 'inspect', 'mime type', 'magic number', 'sha256', 'checksum', 'file type', 'size'],
    popular: true,
    batch: true,
  },
  {
    id: 'hash-generator',
    name: 'File Hash (SHA-256)',
    category: 'files',
    description: 'Compute SHA-1, SHA-256, SHA-384 and SHA-512 checksums of files.',
    about: 'Verify downloads by computing cryptographic checksums with the Web Crypto API. Very large files are hashed in a streaming background worker with a progress bar. Paste an expected hash to compare automatically.',
    supportedFormats: ['*'],
    icon: 'hash',
    component: 'files/hash',
    keywords: ['hash', 'sha256', 'sha-256', 'sha1', 'sha512', 'checksum', 'verify', 'integrity'],
    batch: true,
  },
];
