/**
 * Saving files to the user's device. Uses the File System Access API save
 * dialog when the user enabled it and the browser supports it; otherwise a
 * regular download link. Object URLs are always revoked afterwards.
 */
import { getSettings } from './settings';
import { isAbort } from '../utils/errors';
import { zipFiles } from '../utils/zip';
import type { OutputFile } from '../tools/types';
import { toast } from '../components/toast';
import { safeFileName } from '../utils/format';
import { t } from '../i18n/i18n';

interface SavePickerWindow {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
}

export const supportsSavePicker = (): boolean =>
  typeof window !== 'undefined' && typeof (window as unknown as SavePickerWindow).showSaveFilePicker === 'function';

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const name = safeFileName(filename);
  if (getSettings().savePicker && supportsSavePicker()) {
    try {
      const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
      const handle = await (window as unknown as SavePickerWindow).showSaveFilePicker!({
        suggestedName: name,
        types: ext && blob.type ? [{ accept: { [blob.type]: [ext] } }] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (isAbort(e)) return; // user cancelled the dialog
      // fall through to the classic download on any other error
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser (notably iOS Safari) time to start reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Download several files: one file directly, more as a ZIP archive. */
export async function downloadAll(files: OutputFile[], zipName: string, onProgress?: (f: number) => void): Promise<void> {
  if (files.length === 0) return;
  if (files.length === 1) return downloadBlob(files[0].blob, files[0].name);
  const zip = await zipFiles(
    files.map((f) => ({ name: f.name, data: f.blob })),
    { level: 0, onProgress },
  );
  await downloadBlob(zip, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('Copied to clipboard'), 'success');
    return true;
  } catch {
    // Fallback for older browsers / insecure contexts.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    toast(ok ? t('Copied to clipboard') : t('Copy failed — select the text and copy manually'), ok ? 'success' : 'error');
    return ok;
  }
}
