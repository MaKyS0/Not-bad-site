/**
 * Local malware red-flag scanner (static analysis, no signatures database).
 *
 * This is NOT an antivirus engine. It looks for the tricks that real-world
 * malicious files use and that can be recognised from the bytes alone:
 * executables disguised as documents, double extensions, hidden bidi
 * characters, Office macros and remote templates, PDF JavaScript/launch
 * actions, script droppers, zip bombs, encrypted archives with programs, etc.
 *
 * Pure module (no DOM): runs in a Web Worker and in unit tests.
 */
import { inflateSync, unzlibSync } from 'fflate';
import { headerDimensions, MAX_DECODE_PIXELS } from '../../../utils/imageCore';

export type Severity = 'danger' | 'warn' | 'info';

export interface Finding {
  id: RuleId;
  severity: Severity;
  params?: Record<string, string | number>;
}

export interface ScanReport {
  findings: Finding[];
  /** English label of the detected content type (translate in the UI). */
  detected: string;
  /** Number of bytes whose content was examined. */
  scanned: number;
  /** False when only part of the file could be examined. */
  complete: boolean;
}

export interface Source {
  name: string;
  size: number;
  read(start: number, end: number): Promise<Uint8Array>;
}

/** English texts for each rule. The UI translates them via the i18n dictionary. */
export const RULES = {
  eicar: { title: 'EICAR antivirus test file', detail: 'This is the harmless standard file used to test antivirus software. Real antivirus programs will report it as a virus.' },
  'exe-disguised': { title: 'Program disguised as another file type', detail: '“{name}” is named like a “.{ext}” file, but it is actually a {type}. Malware often hides programs behind innocent-looking extensions.' },
  'double-ext': { title: 'Double extension', detail: '“{name}” hides a program extension behind a fake one. This classic trick makes a program look like a document or a picture.' },
  bidi: { title: 'Hidden characters reverse the file name', detail: '“{name}” contains invisible Unicode control characters that change how the name is displayed, so the real extension may differ from the one you see.' },
  executable: { title: 'Executable program: {type}', detail: 'This file can run code on your device. Open it only if you trust where it came from.' },
  script: { title: 'Script file (.{ext})', detail: 'Scripts run commands on your computer when opened. Open only if you trust the source.' },
  'disk-image': { title: 'Disk image (.{ext})', detail: 'Disk images are often used to deliver malware because Windows may skip its security warnings for files inside them.' },
  shortcut: { title: 'Shortcut file (.{ext})', detail: 'Shortcuts can launch any command. Malicious shortcuts are a common email attachment trick.' },
  'macro-ext': { title: 'Macro-enabled Office file (.{ext})', detail: 'This file type is allowed to contain macros (programs). Do not enable macros unless you trust the sender.' },
  macros: { title: 'Contains macros (VBA code)', detail: 'The document contains macro code. Malicious documents use macros to download and run malware — do not click “Enable content” unless you trust the sender.' },
  'xlm-macros': { title: 'Contains Excel 4.0 (XLM) macro sheets', detail: 'Old-style macro sheets are rarely used legitimately and are a well-known malware technique.' },
  'remote-template': { title: 'Loads content from the internet when opened', detail: 'The document references external content at {host}. This is used to download exploits or macros after the file has passed security checks.' },
  dde: { title: 'DDE command field', detail: 'The document contains a Dynamic Data Exchange field, which can run programs when the document is opened.' },
  'ole-object': { title: 'Embedded object', detail: 'The document contains an embedded OLE object (possibly a program or another document).' },
  'equation-editor': { title: 'Equation Editor exploit pattern', detail: 'The document embeds an old Equation Editor object, which is used by widely exploited vulnerabilities (CVE-2017-11882, CVE-2018-0802).' },
  'pdf-js': { title: 'PDF contains JavaScript', detail: 'Ordinary PDFs rarely need JavaScript. It is a common way to exploit PDF viewers.' },
  'pdf-auto-js': { title: 'PDF runs JavaScript automatically', detail: 'The PDF has an automatic action (on open or on page view) together with JavaScript.' },
  'pdf-autoaction': { title: 'PDF has automatic actions', detail: 'The PDF performs an action when opened. This is often harmless (for example, jumping to a page).' },
  'pdf-launch': { title: 'PDF can launch programs', detail: 'The PDF contains a “Launch” action that can start programs or open files on your computer.' },
  'pdf-embedded': { title: 'PDF contains attached files', detail: 'Files are embedded inside this PDF. Attachments can be programs or other dangerous files.' },
  'pdf-obfuscated': { title: 'PDF keywords are obfuscated', detail: 'Keywords such as JavaScript or OpenAction are hex-encoded to hide them from scanners. Legitimate software does not do this.' },
  'pdf-form-submit': { title: 'PDF can send form data', detail: 'The PDF can submit form contents to a web address. Be careful entering passwords or personal data into it.' },
  'commands-danger': { title: 'Malicious command patterns', detail: 'Found patterns typical of malware droppers: {items}.' },
  'commands-warn': { title: 'Suspicious command patterns', detail: 'Found patterns that can be legitimate but are often used by malware: {items}.' },
  'embedded-pe': { title: 'Hidden Windows program inside the file', detail: 'The file contains an embedded Windows executable (raw or Base64/hex-encoded). Documents and pictures should not contain programs.' },
  'php-in-image': { title: 'Server code hidden in an image', detail: 'The image contains PHP code. This is a web-shell trick aimed at websites that accept uploads; it does not harm your computer when viewed.' },
  'svg-script': { title: 'SVG image with scripts', detail: 'This image contains JavaScript or event handlers. Opened directly in a browser, it can run code — malicious SVGs are used for phishing.' },
  'html-password': { title: 'Web page asks for a password', detail: 'This local HTML page has a password field and sends form data to {host}. Phishing emails attach such pages to steal logins.' },
  'html-smuggling': { title: 'Page builds and downloads a file by itself', detail: 'The page assembles a file from encoded data and triggers a download (“HTML smuggling”), a technique used to slip malware past email filters.' },
  'html-script': { title: 'Contains scripts', detail: 'The file contains JavaScript that runs if it is opened in a browser.' },
  packed: { title: 'Packed program (UPX)', detail: 'The program is compressed with an executable packer. It is common in legitimate tools too, but also used to hide malware.' },
  'zip-traversal': { title: 'Archive writes outside its folder', detail: 'The entry “{name}” uses “../” or an absolute path to escape the extraction folder (“zip slip”).' },
  'zip-bomb': { title: 'Possible zip bomb', detail: 'The archive expands to {size} from a much smaller file (ratio ×{ratio}). Extracting it may fill your disk or crash programs.' },
  'zip-encrypted-exe': { title: 'Password-protected archive with programs', detail: 'The archive hides programs behind a password so that scanners cannot check them. This is a classic malware delivery method.' },
  'zip-encrypted': { title: 'Password-protected entries', detail: '{count} could not be checked because they are encrypted.' },
  'archive-exe': { title: 'Archive contains programs or scripts', detail: '{names}' },
  'archive-nested': { title: 'Nested archives were not unpacked', detail: '{names}' },
  'zip-corrupt': { title: 'Archive structure is damaged or unusual', detail: 'Malformed archives are sometimes used to evade scanners. Some contents could not be checked.' },
  unscannable: { title: 'Archive contents could not be checked', detail: '{type} archives are not unpacked by this scanner. Their contents were not checked.' },
  'image-bomb': { title: 'Image bomb', detail: 'The image claims to be {size} pixels. Opening it can freeze or crash image viewers and browsers.' },
  partial: { title: 'Only part of the file was checked', detail: 'The first {size} of the file content were examined.' },
} as const;

export type RuleId = keyof typeof RULES;

/* ------------------------------------------------------------------ */
/* File name checks                                                   */
/* ------------------------------------------------------------------ */

const set = (s: string) => new Set(s.split(' '));
export const EXEC_EXT = set('exe scr com pif cpl dll sys msi msp msc jar apk app xll ocx gadget appx msix appxbundle msixbundle appref-ms xbap');
export const SCRIPT_EXT = set('bat cmd vbs vbe js jse wsf wsh ws hta ps1 psm1 reg sh command scf inf sct applescript scpt ksh csh');
const DISK_EXT = set('iso img vhd vhdx udf');
const SHORTCUT_EXT = set('lnk url website settingcontent-ms library-ms search-ms');
const MACRO_EXT = set('docm dotm xlsm xltm xlam xla pptm potm ppam ppsm sldm');
const ARCHIVE_EXT = set('zip rar 7z gz tgz tar bz2 xz cab arj lzh ace iso img zst');
/** Extensions that look harmless — the fake part of a double extension. */
const DECOY_EXT = set('pdf doc docx xls xlsx ppt pptx rtf txt csv jpg jpeg png gif bmp webp heic tif tiff mp3 mp4 wav avi mov mkv zip rar 7z htm html odt ods xml json');
const BIDI = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/;

const extOf = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
};
const baseOf = (name: string): string => name.split(/[\\/]/).pop() ?? name;
const isRunnable = (ext: string) => EXEC_EXT.has(ext) || SCRIPT_EXT.has(ext) || SHORTCUT_EXT.has(ext);

/** Findings derived only from a file name (also used for archive entries). */
export function nameFindings(name: string, out: Findings): void {
  const base = baseOf(name);
  if (BIDI.test(base)) out.add('bidi', 'danger', { name: base.replace(new RegExp(BIDI.source, 'g'), '') });
  const parts = base.toLowerCase().split('.');
  if (parts.length >= 3) {
    const last = parts[parts.length - 1].trim();
    const decoy = parts[parts.length - 2].trim();
    if (isRunnable(last) && DECOY_EXT.has(decoy)) out.add('double-ext', 'danger', { name: base });
  }
  // "invoice.pdf                     .exe" — padding pushes the real extension out of view.
  if (/\s{5,}\.[a-z0-9]+$/i.test(base) && isRunnable(extOf(base))) out.add('double-ext', 'danger', { name: base.replace(/\s{5,}/, ' … ') });
}

function typeFindings(ext: string, out: Findings): void {
  if (SCRIPT_EXT.has(ext)) out.add('script', 'warn', { ext });
  else if (DISK_EXT.has(ext)) out.add('disk-image', 'warn', { ext });
  else if (SHORTCUT_EXT.has(ext)) out.add('shortcut', 'warn', { ext });
  else if (MACRO_EXT.has(ext)) out.add('macro-ext', 'warn', { ext });
}

/* ------------------------------------------------------------------ */
/* Findings collection                                                */
/* ------------------------------------------------------------------ */

export class Findings {
  list: Finding[] = [];
  private keys = new Set<string>();
  add(id: RuleId, severity: Severity, params?: Record<string, string | number>): void {
    const key = id + '|' + (params?.name ?? '');
    if (this.keys.has(key)) return;
    this.keys.add(key);
    this.list.push({ id, severity, params });
  }
  has(id: RuleId): boolean {
    return this.list.some((f) => f.id === id);
  }
  remove(id: RuleId): void {
    this.list = this.list.filter((f) => f.id !== id);
  }
}

const RANK: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };
export function verdict(findings: Finding[]): 'danger' | 'warn' | 'clean' {
  if (findings.some((f) => f.severity === 'danger')) return 'danger';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  return 'clean';
}

/* ------------------------------------------------------------------ */
/* Byte helpers                                                       */
/* ------------------------------------------------------------------ */

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 2 ** 32;
const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const latin1 = new TextDecoder('latin1');
const str = (b: Uint8Array) => latin1.decode(b);
const asciiAt = (b: Uint8Array, o: number, len: number) => (b.length >= o + len ? str(b.subarray(o, o + len)) : '');

export function formatSize(n: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${i ? n.toFixed(1) : n} ${u[i]}`;
}

/** Recognise native program formats from the first bytes. */
export function sniffExecutable(b: Uint8Array): string | null {
  if (b[0] === 0x4d && b[1] === 0x5a) {
    const pe = b.length >= 0x40 ? u32(b, 0x3c) : 0;
    if (pe > 0 && pe + 4 <= b.length && asciiAt(b, pe, 4) === 'PE\0\0') {
      const characteristics = pe + 24 <= b.length ? u16(b, pe + 22) : 0;
      return characteristics & 0x2000 ? 'Windows library (DLL)' : 'Windows program (EXE)';
    }
    if (b.length >= 64 && /This program (?:cannot|must) be run/.test(asciiAt(b, 0, Math.min(b.length, 512)))) return 'Windows program (EXE)';
    return null; // a lone "MZ" is too weak a signal (text files can start with it)
  }
  if (b[0] === 0x7f && asciiAt(b, 1, 3) === 'ELF') return 'Linux program (ELF)';
  const m = be32(b, 0);
  if (b.length >= 8 && (m === 0xfeedface || m === 0xfeedfacf || m === 0xcefaedfe || m === 0xcffaedfe)) return 'macOS program (Mach-O)';
  if (b.length >= 8 && m === 0xcafebabe) return be32(b, 4) < 40 ? 'macOS program (Mach-O)' : 'Java class file';
  if (asciiAt(b, 0, 4) === 'dex\n') return 'Android program (DEX)';
  if (b.length >= 20 && u32(b, 0) === 0x4c && u32(b, 4) === 0x00021401) return 'Windows shortcut (LNK)';
  if (asciiAt(b, 0, 4) === 'ITSF') return 'Compiled HTML Help (CHM)';
  return null;
}

// Assembled at runtime so that this script itself is not flagged by antivirus software.
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', 'STANDARD', 'ANTIVIRUS', 'TEST', 'FILE!$H+H*'].join('-');

/** Strong = typical of droppers on its own; weak = suspicious only in combination. */
const INDICATORS: { label: string; re: RegExp; strong?: boolean }[] = [
  { label: 'PowerShell -EncodedCommand', re: /\s-e(?:nc|ncodedcommand|c)?\s+["']?[A-Za-z0-9+/]{40,}={0,2}/i, strong: true },
  { label: 'mshta + URL', re: /\bmshta(?:\.exe)?["']?\s+["']?(?:https?:|vbscript:|javascript:)/i, strong: true },
  { label: 'certutil download/decode', re: /\bcertutil(?:\.exe)?\b[^\n]{0,80}\s[-/](?:urlcache|decode|decodehex)\b/i, strong: true },
  { label: 'regsvr32 remote scriptlet', re: /\bregsvr32(?:\.exe)?\b[^\n]{0,80}\/i:\s*https?:/i, strong: true },
  { label: 'rundll32 javascript', re: /\brundll32(?:\.exe)?\b[^\n]{0,80}javascript:/i, strong: true },
  { label: 'bitsadmin /transfer', re: /\bbitsadmin(?:\.exe)?\b[^\n]{0,80}\/transfer\b/i, strong: true },
  { label: 'download | sh', re: /\b(?:curl|wget)\b[^\n|;]{0,200}\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/i, strong: true },
  { label: 'base64 -d | sh', re: /\bbase64\s+(?:-d|--decode)\b[^\n]{0,60}\|\s*(?:ba)?sh\b/i, strong: true },
  { label: '/dev/tcp reverse shell', re: /\/dev\/tcp\/[\w.-]+\/\d+/, strong: true },
  { label: 'nc -e /bin/sh', re: /\bnc(?:at)?\b[^\n]{0,60}\s-e\s+\/bin\/(?:ba)?sh\b/, strong: true },
  { label: 'vssadmin delete shadows', re: /\bvssadmin(?:\.exe)?\s+delete\s+shadows\b/i, strong: true },
  { label: 'bcdedit recoveryenabled no', re: /\bbcdedit\b[^\n]{0,60}recoveryenabled\s+no\b/i, strong: true },
  { label: 'IEX + download', re: /\b(?:iex|invoke-expression)\b[^\n]{0,200}(?:downloadstring|invoke-webrequest|\biwr\b|net\.webclient)|(?:downloadstring|invoke-webrequest|\biwr\b)[^\n]{0,200}\|\s*(?:iex|invoke-expression)\b/i, strong: true },
  { label: 'Invoke-Expression', re: /\b(?:iex|invoke-expression)\s*[(\s$'"]/i },
  { label: 'WebClient download', re: /\.download(?:string|file|data)\s*\(|\bnet\.webclient\b|\binvoke-webrequest\b|\bstart-bitstransfer\b/i },
  { label: 'hidden window', re: /\s-(?:w|win|windowstyle)\s+hid(?:den)?\b/i },
  { label: 'execution policy bypass', re: /\s-(?:ep|exec|executionpolicy)\s+bypass\b/i },
  { label: 'FromBase64String', re: /\bfrombase64string\s*\(/i },
  { label: 'WScript.Shell', re: /\b(?:wscript\.shell|shell\.application)\b/i },
  { label: 'ActiveXObject/CreateObject', re: /\bnew\s+activexobject\s*\(|\bcreateobject\s*\(\s*["'](?:wscript|shell|msxml2|adodb|scripting\.filesystemobject|winhttp)/i },
  { label: 'cmd /c', re: /\bcmd(?:\.exe)?["']?\s+\/[ck]\s/i },
  { label: 'powershell', re: /\bpowershell(?:\.exe)?\b/i },
  { label: 'eval(atob/unescape)', re: /\beval\s*\(\s*(?:atob|unescape|decodeURIComponent|String\.fromCharCode)\s*\(/ },
  { label: 'document.write(unescape)', re: /\bdocument\.write\s*\(\s*(?:unescape|atob)\s*\(/ },
];

/* ------------------------------------------------------------------ */
/* Content scanning                                                   */
/* ------------------------------------------------------------------ */

const CHUNK = 4 * 1024 * 1024;
const OVERLAP = 1024;
/** Content of files larger than this is only partly scanned. */
export const SCAN_LIMIT = 512 * 1024 * 1024;

type Fmt = 'zip' | 'pdf' | 'ole' | 'rtf' | 'image' | 'media' | 'text' | 'binary' | 'archive' | 'exe';

function formatOf(head: Uint8Array, exe: string | null): { fmt: Fmt; label: string } {
  const a4 = asciiAt(head, 0, 4);
  if (exe) return { fmt: 'exe', label: exe };
  if (a4 === 'PK\x03\x04' || a4 === 'PK\x05\x06') return { fmt: 'zip', label: 'ZIP archive' };
  if (asciiAt(head, 0, 5) === '%PDF-' || /%PDF-/.test(asciiAt(head, 0, Math.min(1024, head.length)))) return { fmt: 'pdf', label: 'PDF document' };
  if (be32(head, 0) === 0xd0cf11e0 && be32(head, 4) === 0xa1b11ae1) return { fmt: 'ole', label: 'Office 97-2003 document / MSI (OLE)' };
  if (asciiAt(head, 0, 5) === '{\\rtf') return { fmt: 'rtf', label: 'RTF document' };
  if (asciiAt(head, 0, 4) === 'Rar!') return { fmt: 'archive', label: 'RAR archive' };
  if (be32(head, 0) === 0x377abcaf) return { fmt: 'archive', label: '7-Zip archive' };
  if (head[0] === 0x1f && head[1] === 0x8b) return { fmt: 'archive', label: 'GZIP archive' };
  if (a4 === 'MSCF') return { fmt: 'archive', label: 'CAB archive' };
  if (asciiAt(head, 0x8001, 5) === 'CD001' || asciiAt(head, 0x8801, 5) === 'CD001') return { fmt: 'archive', label: 'ISO disk image' };
  if (be32(head, 0) === 0x89504e47 || (head[0] === 0xff && head[1] === 0xd8) || asciiAt(head, 0, 3) === 'GIF' || (a4 === 'RIFF' && asciiAt(head, 8, 4) === 'WEBP') || asciiAt(head, 0, 2) === 'BM') {
    return { fmt: 'image', label: 'Image' };
  }
  if (asciiAt(head, 4, 4) === 'ftyp' || a4 === 'OggS' || a4 === 'fLaC' || asciiAt(head, 0, 3) === 'ID3' || be32(head, 0) === 0x1a45dfa3 || (a4 === 'RIFF' && asciiAt(head, 8, 4) === 'WAVE')) {
    return { fmt: 'media', label: 'Audio/video' };
  }
  const sample = head.subarray(0, 8192);
  let ctrl = 0;
  for (const c of sample) if (c < 9 || (c > 13 && c < 32 && c !== 27)) ctrl++;
  if (sample.length && ctrl / sample.length < 0.02) {
    if (sample[0] === 0x23 && sample[1] === 0x21) return { fmt: 'text', label: 'Script (shebang)' };
    return { fmt: 'text', label: 'Text' };
  }
  return { fmt: 'binary', label: 'Binary data' };
}

interface TextState {
  strong: Set<string>;
  weak: Set<string>;
  pdf: Set<string>;
  html: { svg: boolean; script: boolean; password: boolean; formHost: string; blob: boolean; download: boolean; b64: boolean };
}

function scanText(s: string, fmt: Fmt, ext: string, st: TextState, out: Findings, offset: number): void {
  if (s.includes(EICAR)) out.add('eicar', 'danger');
  if (fmt !== 'exe' && fmt !== 'zip' && fmt !== 'archive') {
    if (/TVqQAAMAAAAEAAAA|TVpQAAIAAAAEAA8A|AAAAEAAAAMAAQqVT|4d5a90000300000004000000/i.test(s)) out.add('embedded-pe', 'danger');
    const stub = s.search(/This program (?:cannot|must) be run (?:in DOS mode|under Win32)/);
    if (stub > 0 && offset + stub > 0x100) {
      const start = Math.max(0, stub - 0x100);
      if (s.slice(start, stub).includes('MZ')) out.add('embedded-pe', 'danger');
    }
  }
  if (fmt === 'image' && /<\?php[\s\n]|<\?=\s*\$|\beval\s*\(\s*\$_(?:POST|GET|REQUEST)/i.test(s)) out.add('php-in-image', 'warn');
  if (fmt === 'exe' && /UPX[0!]/.test(s)) out.add('packed', 'info');
  if (fmt === 'ole') {
    if (/_\0V\0B\0A\0_\0P\0R\0O\0J\0E\0C\0T|M\0a\0c\0r\0o\0s\0\0/.test(s)) out.add('macros', 'danger');
    if (/E\0q\0u\0a\0t\0i\0o\0n\0 \0N\0a\0t\0i\0v\0e/.test(s)) out.add('equation-editor', 'danger');
    if (/O\x00l\x00e\x001\x000\x00N\x00a\x00t\x00i\x00v\x00e/.test(s)) out.add('ole-object', 'warn');
  }
  if (fmt === 'rtf') {
    if (/\\obj(?:data|emb|link|autlink|update|ocx)\b/i.test(s)) out.add('ole-object', 'warn');
    if (/4571756174696f6e2e33|0002ce02-?0000-?0000-?c000-?000000000046|02ce020000000000c000000000000046|equation\.3/i.test(s)) out.add('equation-editor', 'danger');
  }
  if (fmt === 'pdf') scanPdfText(s, st, out);
  if (fmt === 'text' || SCRIPT_EXT.has(ext)) {
    for (const ind of INDICATORS) if (ind.re.test(s)) (ind.strong ? st.strong : st.weak).add(ind.label);
    const h = st.html;
    if (/<svg[\s>]/i.test(s)) h.svg = true;
    if (/<script[\s>]|\son(?:load|error|click|mouseover|begin|focus|activate)\s*=|(?:href|src)\s*=\s*["']?\s*javascript:/i.test(s)) h.script = true;
    if (/<input[^>]{0,200}type\s*=\s*["']?password/i.test(s)) h.password = true;
    const form = /<form[^>]{0,300}action\s*=\s*["']?\s*https?:\/\/([^/"'\s>:]+)/i.exec(s);
    if (form) h.formHost = form[1];
    if (/URL\.createObjectURL\s*\(|msSaveOrOpenBlob\s*\(|msSaveBlob\s*\(/.test(s)) h.blob = true;
    if (/\.download\s*=|\sdownload\s*=\s*["']|\.setAttribute\s*\(\s*["']download["']/.test(s)) h.download = true;
    if (/[A-Za-z0-9+/]{20000,}/.test(s) || /\batob\s*\(/.test(s)) h.b64 = true;
  }
}

const PDF_KEYS = ['JavaScript', 'JS', 'OpenAction', 'AA', 'Launch', 'EmbeddedFile', 'EmbeddedFiles', 'SubmitForm', 'ObjStm'];
function scanPdfText(s: string, st: TextState, out: Findings): void {
  for (const m of s.matchAll(/\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|SubmitForm|ObjStm)(?=[\s/<>[\]()%]|$)/g)) st.pdf.add(m[1]);
  // Hex-escaped names, e.g. /J#61vaScript — decode and check for hidden keywords.
  for (const m of s.matchAll(/\/[A-Za-z0-9]*#[0-9A-Fa-f]{2}[A-Za-z0-9#]*/g)) {
    const name = m[0].slice(1).replace(/#([0-9A-Fa-f]{2})/g, (_, x: string) => String.fromCharCode(parseInt(x, 16)));
    if (PDF_KEYS.includes(name)) {
      st.pdf.add(name);
      out.add('pdf-obfuscated', 'warn');
    }
  }
}

/** Inflate PDF object streams (where scripts are often hidden) and scan them too. */
function scanPdfObjectStreams(buf: Uint8Array, st: TextState, out: Findings): void {
  const s = str(buf);
  let budget = 64 * 1024 * 1024;
  let count = 0;
  for (const m of s.matchAll(/\/Type\s*\/ObjStm\b/g)) {
    if (++count > 2000 || budget <= 0) break;
    const at = s.indexOf('stream', m.index);
    if (at < 0 || at - m.index > 4096) continue;
    let start = at + 6;
    if (s[start] === '\r') start++;
    if (s[start] === '\n') start++;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const data = unzlibSync(buf.subarray(start, end));
      budget -= data.length;
      scanPdfText(str(data), st, out);
    } catch {
      /* not Flate or damaged — skip */
    }
  }
}

function finishText(st: TextState, fmt: Fmt, ext: string, out: Findings): void {
  if (st.pdf.has('Launch')) out.add('pdf-launch', 'danger');
  const js = st.pdf.has('JavaScript') || st.pdf.has('JS');
  const auto = st.pdf.has('OpenAction') || st.pdf.has('AA');
  if (js && auto) out.add('pdf-auto-js', 'danger');
  else if (js) out.add('pdf-js', 'warn');
  else if (auto) out.add('pdf-autoaction', 'info');
  if (st.pdf.has('EmbeddedFile') || st.pdf.has('EmbeddedFiles')) out.add('pdf-embedded', 'warn');
  if (st.pdf.has('SubmitForm')) out.add('pdf-form-submit', 'info');

  const strong = [...st.strong];
  const weak = [...st.weak];
  if (strong.length || weak.length >= 3) out.add('commands-danger', 'danger', { items: [...strong, ...weak].join(', ') });
  else if (weak.length) out.add('commands-warn', SCRIPT_EXT.has(ext) ? 'warn' : 'info', { items: weak.join(', ') });

  const h = st.html;
  if (fmt === 'text') {
    const isSvg = h.svg && (ext === 'svg' || !/^html?$/.test(ext));
    if (isSvg && h.script) out.add('svg-script', 'warn');
    if (h.password && h.formHost) out.add('html-password', 'warn', { host: h.formHost });
    if (h.blob && h.download && h.b64) out.add('html-smuggling', 'danger');
    else if (h.script && /^(?:hta|html?|xhtml|shtml|mht|mhtml)$/.test(ext) && !out.has('svg-script')) out.add('html-script', ext === 'hta' ? 'warn' : 'info');
  }
}

/* ------------------------------------------------------------------ */
/* ZIP (incl. Office Open XML, JAR, APK)                              */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  flags: number;
  method: number;
  csize: number;
  usize: number;
  offset: number;
}

async function readZipDirectory(src: Source): Promise<ZipEntry[] | null> {
  const tailLen = Math.min(src.size, 65_557 + 20);
  const tail = await src.read(src.size - tailLen, src.size);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  let total = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOff = u32(tail, eocd + 16);
  if ((cdOff === 0xffffffff || total === 0xffff) && eocd >= 20 && u32(tail, eocd - 20) === 0x07064b50) {
    const z64 = u64(tail, eocd - 20 + 8);
    const rec = await src.read(z64, Math.min(src.size, z64 + 56));
    if (u32(rec, 0) === 0x06064b50) {
      total = u64(rec, 32);
      cdSize = u64(rec, 40);
      cdOff = u64(rec, 48);
    }
  }
  if (cdOff + cdSize > src.size || cdSize > 256 * 1024 * 1024) return null;
  const cd = await src.read(cdOff, cdOff + cdSize);
  const entries: ZipEntry[] = [];
  const utf8 = new TextDecoder('utf-8');
  let p = 0;
  while (p + 46 <= cd.length && u32(cd, p) === 0x02014b50 && entries.length < 1_000_000) {
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    const e: ZipEntry = {
      flags: u16(cd, p + 8),
      method: u16(cd, p + 10),
      csize: u32(cd, p + 20),
      usize: u32(cd, p + 24),
      offset: u32(cd, p + 42),
      name: utf8.decode(cd.subarray(p + 46, p + 46 + nameLen)),
    };
    // ZIP64 extended sizes.
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = u16(cd, x);
      const len = u16(cd, x + 2);
      if (id === 1) {
        let q = x + 4;
        if (e.usize === 0xffffffff) (e.usize = u64(cd, q)), (q += 8);
        if (e.csize === 0xffffffff) (e.csize = u64(cd, q)), (q += 8);
        if (e.offset === 0xffffffff) e.offset = u64(cd, q);
      }
      x += 4 + len;
    }
    entries.push(e);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries.length || !total ? entries : null;
}

async function readEntry(src: Source, e: ZipEntry, limit: number): Promise<Uint8Array | null> {
  if (e.flags & 1 || e.usize > limit || (e.method !== 0 && e.method !== 8)) return null;
  const lh = await src.read(e.offset, Math.min(src.size, e.offset + 30));
  if (lh.length < 30 || u32(lh, 0) !== 0x04034b50) return null;
  const start = e.offset + 30 + u16(lh, 26) + u16(lh, 28);
  if (start + e.csize > src.size) return null;
  const raw = await src.read(start, start + e.csize);
  if (e.method === 0) return raw;
  // A caller-provided output buffer is never grown by fflate, so an entry that
  // lies about its size cannot blow up memory (the output is just truncated).
  try {
    return inflateSync(raw, { out: new Uint8Array(Math.max(e.usize, 1)) });
  } catch {
    return null;
  }
}

async function scanZip(src: Source, out: Findings, onProgress?: (f: number) => void): Promise<{ label: string | null } | null> {
  const entries = await readZipDirectory(src);
  if (!entries) {
    out.add('zip-corrupt', 'warn');
    return null;
  }
  const names = new Set(entries.map((e) => e.name));
  const has = (re: RegExp) => entries.some((e) => re.test(e.name));
  let label: string | null = null;
  if (names.has('[Content_Types].xml')) label = has(/^word\//) ? 'Word document' : has(/^xl\//) ? 'Excel workbook' : has(/^ppt\//) ? 'PowerPoint presentation' : 'Office document';
  else if (names.has('AndroidManifest.xml') && has(/^classes\d*\.dex$/)) label = 'Android app (APK)';
  else if (names.has('META-INF/MANIFEST.MF') && has(/\.class$/)) label = 'Java program (JAR)';
  else if (names.has('mimetype') && has(/^META-INF\/container\.xml$/)) label = 'EPUB / OpenDocument';
  if (label === 'Android app (APK)' || label === 'Java program (JAR)') out.add('executable', 'warn', { type: label });

  let total = 0;
  let encrypted = 0;
  const runnable: string[] = [];
  const nested: string[] = [];
  for (const e of entries) {
    if (e.name.endsWith('/')) continue;
    total += e.usize;
    if (e.flags & 1) encrypted++;
    if (/^(?:[\\/]|[a-zA-Z]:)|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(e.name)) out.add('zip-traversal', 'danger', { name: e.name });
    nameFindings(e.name, out);
    const ext = extOf(e.name);
    if (isRunnable(ext) && !label) runnable.push(e.name);
    if (ARCHIVE_EXT.has(ext)) nested.push(e.name);
  }
  const ratio = total / Math.max(1, src.size);
  if (total > 512 * 1024 ** 2 && ratio > 100) out.add('zip-bomb', 'danger', { size: formatSize(total), ratio: Math.round(ratio) });
  if (encrypted) {
    if (runnable.length || entries.some((e) => e.flags & 1 && isRunnable(extOf(e.name)))) out.add('zip-encrypted-exe', 'danger');
    else out.add('zip-encrypted', 'warn', { count: encrypted });
  }
  if (runnable.length) out.add('archive-exe', 'warn', { names: listNames(runnable) });
  if (nested.length) out.add('archive-nested', 'info', { names: listNames(nested) });

  // Office Open XML specifics.
  if (label && /Word|Excel|PowerPoint|Office/.test(label)) {
    if (has(/(?:^|\/)vbaProject\.bin$/i)) out.add('macros', 'danger');
    if (has(/^xl\/macrosheets\//i)) out.add('xlm-macros', 'danger');
    if (has(/\/embeddings\/oleObject\d*\.bin$/i)) out.add('ole-object', 'warn');
    for (const e of entries.filter((x) => /\.rels$/i.test(x.name)).slice(0, 200)) {
      const data = await readEntry(src, e, 4 * 1024 * 1024);
      if (!data) continue;
      for (const m of str(data).matchAll(/<Relationship\b[^>]*>/gi)) {
        const tag = m[0];
        if (!/TargetMode\s*=\s*["']External/i.test(tag)) continue;
        if (!/Type\s*=\s*["'][^"']*\/(?:attachedTemplate|oleObject|frame|subDocument)["']/i.test(tag)) continue;
        const host = /Target\s*=\s*["']\s*(?:https?|ftp):\/\/([^/"'\s:]+)/i.exec(tag)?.[1] ?? /Target\s*=\s*["']\s*\\\\([^\\"']+)/.exec(tag)?.[1];
        if (host) out.add('remote-template', 'danger', { host });
      }
    }
    for (const e of entries.filter((x) => /^(?:word\/document|xl\/worksheets\/sheet\d+|xl\/externalLinks\/externalLink\d+)\.xml$/i.test(x.name)).slice(0, 50)) {
      const data = await readEntry(src, e, 32 * 1024 * 1024);
      if (data && /instr(?:Text[^>]*>|\s*=\s*")\s*(?:"\s*)?DDE(?:AUTO)?\b|ddeService\s*=/i.test(str(data))) out.add('dde', 'danger');
    }
    return { label };
  }

  // Look inside small entries: disguised programs, EICAR, script droppers.
  let budget = 128 * 1024 * 1024;
  const candidates = entries.filter((e) => !e.name.endsWith('/') && !(e.flags & 1) && e.usize <= 16 * 1024 * 1024).slice(0, 500);
  for (let i = 0; i < candidates.length && budget > 0; i++) {
    const e = candidates[i];
    const data = await readEntry(src, e, 16 * 1024 * 1024);
    onProgress?.((i + 1) / candidates.length);
    if (!data) continue;
    budget -= data.length;
    const inner = new Findings();
    const ext = extOf(e.name);
    const exe = sniffExecutable(data.subarray(0, 4096));
    if (exe && !isRunnable(ext) && ext !== 'bin' && ext !== 'so' && ext !== 'dylib' && ext !== 'node' && ext !== 'class' && ext !== 'dex') {
      out.add('exe-disguised', 'danger', { name: e.name, ext: ext || '—', type: exe });
    } else if (exe && !runnable.includes(e.name) && !label) runnable.push(e.name);
    const { fmt } = formatOf(data.subarray(0, 0x9000), exe);
    const st = newTextState();
    scanText(str(data), fmt, ext, st, inner, 0);
    finishText(st, fmt, ext, inner);
    for (const f of inner.list) {
      if (f.severity === 'info') continue;
      out.add(f.id, f.severity, { ...f.params, name: e.name });
    }
  }
  if (runnable.length && !out.has('archive-exe')) out.add('archive-exe', 'warn', { names: listNames(runnable) });
  return { label };
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 6).join(', ');
  return names.length > 6 ? `${shown} … (+${names.length - 6})` : shown;
}

const newTextState = (): TextState => ({
  strong: new Set(),
  weak: new Set(),
  pdf: new Set(),
  html: { svg: false, script: false, password: false, formHost: '', blob: false, download: false, b64: false },
});

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

export async function scanFile(src: Source, onProgress?: (f: number) => void): Promise<ScanReport> {
  const out = new Findings();
  const ext = extOf(src.name);
  nameFindings(src.name, out);

  const head = await src.read(0, Math.min(src.size, 0x9000));
  const exe = sniffExecutable(head);
  let { fmt, label } = formatOf(head, exe);

  if (exe) {
    const expected = isRunnable(ext) || ext === 'bin' || ext === 'so' || ext === 'dylib' || ext === 'class' || ext === 'dex' || ext === 'node' || ext === '';
    if (!expected) out.add('exe-disguised', 'danger', { name: src.name, ext, type: exe });
    else if (!out.has('double-ext')) out.add('executable', 'warn', { type: exe });
  } else if (EXEC_EXT.has(ext) && fmt !== 'zip') {
    out.add('executable', 'warn', { type: `.${ext}` });
  }
  typeFindings(ext, out);
  if (label === 'Script (shebang)' && !SCRIPT_EXT.has(ext)) out.add('script', 'warn', { ext: ext || 'sh' });

  if (fmt === 'image') {
    const d = headerDimensions(head);
    if (d && d.width * d.height > MAX_DECODE_PIXELS) out.add('image-bomb', 'warn', { size: `${d.width} × ${d.height}` });
  }
  let zipOk = false;
  if (fmt === 'zip') {
    const z = await scanZip(src, out, onProgress);
    zipOk = Boolean(z);
    if (z?.label) label = z.label;
  } else if (fmt === 'archive') {
    out.add('unscannable', 'info', { type: label });
  }

  // Byte-level content scan, chunk by chunk with overlap.
  // (A readable ZIP was already checked entry by entry above.)
  const limit = zipOk ? 0 : Math.min(src.size, SCAN_LIMIT);
  const st = newTextState();
  const deepPdf = fmt === 'pdf' && src.size <= 200 * 1024 * 1024;
  const whole: Uint8Array[] = [];
  for (let off = 0; off < limit; off += CHUNK) {
    const start = Math.max(0, off - OVERLAP);
    const bytes = await src.read(start, Math.min(limit, off + CHUNK));
    if (deepPdf) whole.push(bytes.subarray(off - start));
    scanText(str(bytes), fmt, ext, st, out, start);
    onProgress?.(Math.min(limit, off + CHUNK) / Math.max(1, limit));
  }
  if (deepPdf) {
    const buf = whole.length === 1 ? whole[0] : concat(whole);
    scanPdfObjectStreams(buf, st, out);
  }
  finishText(st, fmt, ext, out);
  if (!zipOk && limit < src.size) out.add('partial', 'info', { size: formatSize(limit) });

  out.list.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return { findings: out.list, detected: label, scanned: zipOk ? src.size : limit, complete: zipOk || limit === src.size };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Wrap an in-memory buffer as a Source (tests, archive entries). */
export function bytesSource(name: string, data: Uint8Array): Source {
  return { name, size: data.length, read: async (s, e) => data.subarray(s, e) };
}
