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

export interface FriendlyError {
  title: string;
  message: string;
  details?: string;
}

export function describeError(e: unknown): FriendlyError {
  if (e instanceof UserError) {
    return { title: e.message, message: e.hint ?? '' };
  }
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes('quota') || lower.includes('out of memory') || lower.includes('allocation') || e instanceof RangeError) {
    return {
      title: 'Not enough memory for this file.',
      message: 'The file may be too large for this device. Try a smaller file, close other tabs, or use a desktop browser.',
      details: raw,
    };
  }
  if (lower.includes('encrypt') || lower.includes('password')) {
    return {
      title: 'This file is encrypted.',
      message: 'Password-protected files cannot be processed in the browser. Remove the password in the original application and try again.',
      details: raw,
    };
  }
  return {
    title: 'Something went wrong.',
    message: 'The selected file may be corrupted, unsupported, or too large.',
    details: raw,
  };
}
