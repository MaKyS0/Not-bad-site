/**
 * Errors with a message that is safe and useful to show to users.
 * Anything that is not a UserError is shown with a generic explanation and
 * the technical message in a collapsible "details" block.
 */
export class UserError extends Error {
  constructor(
    message: string,
    public hint?: string,
  ) {
    super(message);
    this.name = 'UserError';
  }
}

/** Thrown when the user aborts or the tool unmounts mid-operation. */
export class AbortedError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'AbortError';
  }
}

export const isAbort = (e: unknown): boolean =>
  e instanceof AbortedError || (e instanceof DOMException && e.name === 'AbortError') || (e as { name?: string })?.name === 'AbortError';

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AbortedError();
}

/**
 * Translation hook for user-facing error texts. Kept as an injectable function
 * so this module stays tiny inside Web Workers (no dictionary bundled there).
 */
let translate: (s: string) => string = (s) => s;
export function setErrorTranslator(fn: (s: string) => string): void {
  translate = fn;
}

export interface FriendlyError {
  title: string;
  message: string;
  details?: string;
}

export function describeError(e: unknown): FriendlyError {
  if (e instanceof UserError || (e as Error)?.name === 'UserError') {
    const ue = e as UserError;
    return { title: translate(ue.message), message: ue.hint ? translate(ue.hint) : '' };
  }
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes('quota') || lower.includes('out of memory') || lower.includes('allocation') || e instanceof RangeError) {
    return {
      title: translate('Not enough memory for this file.'),
      message: translate('The file may be too large for this device. Try a smaller file, close other tabs, or use a desktop browser.'),
      details: raw,
    };
  }
  if (lower.includes('encrypt') || lower.includes('password')) {
    return {
      title: translate('This file is encrypted.'),
      message: translate('Password-protected files cannot be processed in the browser. Remove the password in the original application and try again.'),
      details: raw,
    };
  }
  return {
    title: translate('Something went wrong.'),
    message: translate('The selected file may be corrupted, unsupported, or too large.'),
    details: raw,
  };
}
