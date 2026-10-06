/**
 * In-memory hand-over of files between pages (e.g. home drop zone → tool).
 * Files are never persisted; a full page reload clears them.
 */
let pending: { toolId: string | null; files: File[] } = { toolId: null, files: [] };
let staged: File[] = [];

/** Files dropped on the home page, waiting for the user to pick a tool. */
export const getStaged = (): File[] => staged;
export const setStaged = (files: File[]): void => {
  staged = files;
};

export function handOver(toolId: string, files: File[]): void {
  pending = { toolId, files };
}

export function takeFiles(toolId: string): File[] {
  if (pending.toolId !== toolId) return [];
  const files = pending.files;
  pending = { toolId: null, files: [] };
  return files;
}
