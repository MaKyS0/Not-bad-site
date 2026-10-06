/**
 * File type detection by extension, declared MIME type and magic bytes.
 * Magic-byte sniffing protects against renamed/mislabelled files and lets us
 * pick the right decoder regardless of what the OS reported.
 */
import { extOf } from './format';

export type Kind = 'image' | 'pdf' | 'zip' | 'audio' | 'text' | 'data' | 'video' | 'other';

export interface DetectedType {
  /** Canonical extension, e.g. "jpg" */
  ext: string;
  mime: string;
  kind: Kind;
  label: string;
}

const T = (ext: string, mime: string, kind: Kind, label: string): DetectedType => ({ ext, mime, kind, label });

export const TYPES: Record<string, DetectedType> = {
  png: T('png', 'image/png', 'image', 'PNG image'),
  jpg: T('jpg', 'image/jpeg', 'image', 'JPEG image'),
  webp: T('webp', 'image/webp', 'image', 'WebP image'),
  gif: T('gif', 'image/gif', 'image', 'GIF image'),
  bmp: T('bmp', 'image/bmp', 'image', 'BMP image'),
  ico: T('ico', 'image/x-icon', 'image', 'ICO icon'),
  svg: T('svg', 'image/svg+xml', 'image', 'SVG vector image'),
  avif: T('avif', 'image/avif', 'image', 'AVIF image'),
  tiff: T('tiff', 'image/tiff', 'image', 'TIFF image'),
  heic: T('heic', 'image/heic', 'image', 'HEIC image'),
  pdf: T('pdf', 'application/pdf', 'pdf', 'PDF document'),
  zip: T('zip', 'application/zip', 'zip', 'ZIP archive'),
  gz: T('gz', 'application/gzip', 'other', 'GZIP archive'),
  rar: T('rar', 'application/vnd.rar', 'other', 'RAR archive'),
  '7z': T('7z', 'application/x-7z-compressed', 'other', '7-Zip archive'),
  mp3: T('mp3', 'audio/mpeg', 'audio', 'MP3 audio'),
  wav: T('wav', 'audio/wav', 'audio', 'WAV audio'),
  ogg: T('ogg', 'audio/ogg', 'audio', 'OGG audio'),
  flac: T('flac', 'audio/flac', 'audio', 'FLAC audio'),
  m4a: T('m4a', 'audio/mp4', 'audio', 'M4A/AAC audio'),
  mp4: T('mp4', 'video/mp4', 'video', 'MP4 video'),
  webm: T('webm', 'video/webm', 'video', 'WebM media'),
  txt: T('txt', 'text/plain', 'text', 'Plain text'),
  md: T('md', 'text/markdown', 'text', 'Markdown'),
  csv: T('csv', 'text/csv', 'data', 'CSV table'),
  tsv: T('tsv', 'text/tab-separated-values', 'data', 'TSV table'),
  json: T('json', 'application/json', 'data', 'JSON data'),
  xml: T('xml', 'application/xml', 'data', 'XML document'),
  html: T('html', 'text/html', 'text', 'HTML document'),
};

const EXT_ALIASES: Record<string, string> = {
  jpeg: 'jpg', jpe: 'jpg', jfif: 'jpg', markdown: 'md', tif: 'tiff', heif: 'heic', oga: 'ogg', opus: 'ogg',
  htm: 'html', geojson: 'json', aac: 'm4a', log: 'txt', text: 'txt',
};

export function canonicalExt(ext: string): string {
  const e = ext.toLowerCase();
  return EXT_ALIASES[e] ?? e;
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0): boolean =>
  sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, start: number, len: number): string =>
  String.fromCharCode(...b.subarray(start, start + len));

/** Detect a type from the first bytes of a file. Returns undefined if unknown. */
export function sniffBytes(b: Uint8Array): DetectedType | undefined {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return TYPES.png;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return TYPES.jpg;
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return TYPES.gif;
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return TYPES.webp;
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return TYPES.wav;
  if (ascii(b, 0, 2) === 'BM' && b.length > 14) return TYPES.bmp;
  if (startsWith(b, [0, 0, 1, 0]) && b[4] > 0) return TYPES.ico;
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (brand === 'avif' || brand === 'avis') return TYPES.avif;
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') return TYPES.heic;
    if (brand.startsWith('M4A')) return TYPES.m4a;
    return TYPES.mp4;
  }
  if (startsWith(b, [0x49, 0x49, 0x2a, 0]) || startsWith(b, [0x4d, 0x4d, 0, 0x2a])) return TYPES.tiff;
  if (ascii(b, 0, 5) === '%PDF-') return TYPES.pdf;
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return TYPES.zip;
  if (startsWith(b, [0x1f, 0x8b])) return TYPES.gz;
  if (ascii(b, 0, 4) === 'Rar!') return TYPES.rar;
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return TYPES['7z'];
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return TYPES.mp3;
  if (ascii(b, 0, 4) === 'OggS') return TYPES.ogg;
  if (ascii(b, 0, 4) === 'fLaC') return TYPES.flac;
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return TYPES.webm;
  // Text-based formats: look at the first non-whitespace characters.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 512)).replace(/^﻿/, '').trimStart();
  if (/^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) return TYPES.svg;
  if (/^<\?xml/i.test(head)) return TYPES.xml;
  if (/^<!doctype html|^<html[\s>]/i.test(head)) return TYPES.html;
  return undefined;
}

export async function readHead(file: Blob, bytes = 512): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, bytes).arrayBuffer());
}

export interface FileTypeInfo {
  /** Extension from the file name (lower-case, canonical). */
  ext: string;
  /** Type detected from content (or from extension if content is not recognisable). */
  detected: DetectedType;
  /** True when the content clearly contradicts the extension. */
  mismatch: boolean;
}

export async function detectFileType(file: File): Promise<FileTypeInfo> {
  const ext = canonicalExt(extOf(file.name));
  let sniffed: DetectedType | undefined;
  try {
    sniffed = sniffBytes(await readHead(file));
  } catch {
    sniffed = undefined;
  }
  const byExt = TYPES[ext];
  const fallback = byExt ?? T(ext || 'bin', file.type || 'application/octet-stream', 'other', ext ? `${ext.toUpperCase()} file` : 'Unknown file');
  // SVG files may start with comments; text formats (json/csv/txt) have no magic.
  const detected = sniffed ?? fallback;
  const mismatch = Boolean(
    sniffed && byExt && sniffed.ext !== byExt.ext && !(sniffed.ext === 'xml' && byExt.ext === 'svg') && !(sniffed.ext === 'mp4' && byExt.kind === 'audio'),
  );
  return { ext, detected, mismatch };
}

/** Quick synchronous guess by extension/MIME (for UI grouping before sniffing finishes). */
export function guessKind(file: File): Kind {
  const t = TYPES[canonicalExt(extOf(file.name))];
  if (t) return t.kind;
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('text/')) return 'text';
  if (file.type === 'application/pdf') return 'pdf';
  return 'other';
}

export const isImageFile = (f: File): boolean => guessKind(f) === 'image';
