/**
 * Text input area with "Open file", drag & drop of text files, encoding
 * selection and a character/size indicator. Text is always handled as plain
 * text (never rendered as HTML).
 */
import { h } from '../utils/dom';
import { button, select } from './ui';
import { filesFromDataTransfer } from './dropzone';
import { formatBytes } from '../utils/format';
import { toast } from './toast';

export const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
  { value: 'windows-1251', label: 'Windows-1251 (Cyrillic)' },
  { value: 'koi8-r', label: 'KOI8-R' },
  { value: 'windows-1252', label: 'Windows-1252 (Western)' },
  { value: 'iso-8859-1', label: 'ISO-8859-1 (Latin-1)' },
  { value: 'iso-8859-2', label: 'ISO-8859-2 (Central European)' },
  { value: 'iso-8859-15', label: 'ISO-8859-15' },
  { value: 'windows-1250', label: 'Windows-1250' },
  { value: 'shift_jis', label: 'Shift_JIS' },
  { value: 'euc-kr', label: 'EUC-KR' },
  { value: 'gbk', label: 'GBK' },
  { value: 'big5', label: 'Big5' },
];

/** Decode bytes with BOM detection (BOM wins over the chosen encoding). */
export function decodeText(bytes: Uint8Array, encoding = 'utf-8'): string {
  let enc = encoding;
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) { enc = 'utf-8'; start = 3; }
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { enc = 'utf-16le'; start = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { enc = 'utf-16be'; start = 2; }
  try {
    return new TextDecoder(enc).decode(bytes.subarray(start));
  } catch {
    return new TextDecoder('utf-8').decode(bytes.subarray(start));
  }
}

/** Heuristic: is this valid UTF-8? Used to suggest another encoding. */
export function looksLikeUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 1 << 20));
    return true;
  } catch {
    return false;
  }
}

export interface TextEditor {
  el: HTMLElement;
  textarea: HTMLTextAreaElement;
  get value(): string;
  set value(v: string);
  fileName: string | null;
}

export interface TextEditorOptions {
  label: string;
  placeholder?: string;
  accept?: string[];
  onInput?: (value: string) => void;
  /** Show an encoding selector for opened files. */
  encoding?: boolean;
  rows?: number;
  sample?: string;
  readonly?: boolean;
  /** Max file size to load into the textarea (bytes). */
  maxBytes?: number;
}

export function textEditor(opts: TextEditorOptions): TextEditor {
  const id = `te-${Math.random().toString(36).slice(2, 8)}`;
  const textarea = h('textarea', {
    id,
    class: 'input',
    rows: opts.rows ?? 12,
    placeholder: opts.placeholder,
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    readonly: opts.readonly,
  });
  const info = h('span', { class: 'hint' });
  let lastFile: File | null = null;
  let encoding = 'utf-8';
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024;

  const updateInfo = () => {
    const v = textarea.value;
    info.textContent = v ? `${v.length.toLocaleString()} characters` : '';
  };
  const emit = () => {
    updateInfo();
    opts.onInput?.(textarea.value);
  };
  textarea.addEventListener('input', emit);

  const fileInput = h('input', { type: 'file', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', accept: opts.accept?.length && !opts.accept.includes('*') ? opts.accept.map((e) => `.${e}`).join(',') : undefined });
  const load = async (file: File) => {
    if (file.size > maxBytes) {
      toast(`File is too large for the text editor (${formatBytes(file.size)} > ${formatBytes(maxBytes)}).`, 'error', 5000);
      return;
    }
    lastFile = file;
    handle.fileName = file.name;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (encoding === 'utf-8' && !looksLikeUtf8(bytes)) {
      toast('This file is not valid UTF-8 — try another encoding in the selector.', 'info', 5000);
    }
    textarea.value = decodeText(bytes, encoding);
    emit();
  };
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void load(f);
    fileInput.value = '';
  });
  textarea.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  textarea.addEventListener('drop', async (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    const files = await filesFromDataTransfer(e.dataTransfer);
    if (files[0]) void load(files[0]);
  });
  textarea.dataset.dropzone = '';

  const encSel = opts.encoding
    ? select(ENCODINGS as { value: string; label: string }[], encoding, (v) => {
        encoding = v;
        if (lastFile) void load(lastFile);
      })
    : null;
  if (encSel) {
    encSel.setAttribute('aria-label', 'Text encoding');
    encSel.style.width = 'auto';
  }

  const toolbar = h(
    'div',
    { class: 'toolbar' },
    opts.readonly ? null : button('Open file', { variant: 'secondary', size: 'sm', icon: 'upload', onClick: () => fileInput.click() }),
    encSel,
    opts.sample && !opts.readonly ? button('Sample', { variant: 'ghost', size: 'sm', onClick: () => { textarea.value = opts.sample!; lastFile = null; emit(); } }) : null,
    opts.readonly ? null : button('Clear', { variant: 'ghost', size: 'sm', icon: 'x', onClick: () => { textarea.value = ''; lastFile = null; handle.fileName = null; emit(); textarea.focus(); } }),
    h('span', { class: 'toolbar-end' }, info),
  );

  const el = h('div', { class: 'field' }, h('label', { for: id }, opts.label), toolbar, textarea, fileInput);
  const handle: TextEditor = {
    el,
    textarea,
    get value() {
      return textarea.value;
    },
    set value(v: string) {
      textarea.value = v;
      updateInfo();
    },
    fileName: null,
  };
  return handle;
}

/** Load a File (e.g. handed over from the home page) into an editor. */
export async function loadIntoEditor(ed: TextEditor, file: File): Promise<void> {
  ed.value = decodeText(new Uint8Array(await file.arrayBuffer()));
  ed.fileName = file.name;
  ed.textarea.dispatchEvent(new Event('input'));
}
