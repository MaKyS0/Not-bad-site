/**
 * Core types for the Tool Registry.
 *
 * Tool metadata (ToolMeta) is plain data: it is imported both by the browser
 * app and by the build step that generates static SEO pages, so it must never
 * import DOM code or heavy libraries. The actual UI/processing code lives in a
 * separate module that is loaded lazily (code splitting) when the tool opens.
 */

export type CategoryId =
  | 'image'
  | 'pdf'
  | 'files'
  | 'data'
  | 'text'
  | 'archive'
  | 'audio'
  | 'developer';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface ToolMeta {
  /** URL slug, unique. Used as /tools/<id>/ */
  id: string;
  /** Short human name, e.g. "PNG to WebP" */
  name: string;
  category: CategoryId;
  /** One-sentence description shown on cards. */
  description: string;
  /** Longer SEO description shown on the tool page. */
  about?: string;
  /** Lower-case extensions this tool accepts ("*" = any file, [] = no file input). */
  supportedFormats: string[];
  /** Icon name from components/icons.ts */
  icon: string;
  /**
   * Module path (relative to src/tools/) that implements the tool UI.
   * Loaded lazily via import.meta.glob in registry.ts.
   */
  component: string;
  /** Options passed to the component, used for preset variants (e.g. PNG → WebP). */
  preset?: Record<string, unknown>;
  /** Extra search terms. */
  keywords?: string[];
  /** Shown in "Popular tools". */
  popular?: boolean;
  /** Variant of another tool (kept out of the main grids, still searchable and has its own page). */
  variantOf?: string;
  /** Accepts several files at once / supports batch processing. */
  batch?: boolean;
  /** Tool-specific FAQ entries (a generic privacy FAQ is added automatically). */
  faq?: FaqItem[];
  /** Custom <title>; defaults to "<name> — free, private, in your browser". */
  title?: string;
  /** Custom meta description; defaults to description. */
  metaDescription?: string;
}

/** Everything a tool component gets from the app shell. */
export interface ToolContext {
  meta: ToolMeta;
  preset: Record<string, unknown>;
  /** Files handed over from the home page drop zone (may be empty). */
  initialFiles: File[];
  /** Create an object URL that is revoked automatically when the tool unmounts. */
  objectUrl(blob: Blob): string;
  /** Explicitly revoke an object URL created with objectUrl(). */
  revokeUrl(url: string): void;
  /** Register cleanup callbacks run on unmount. */
  onCleanup(fn: () => void): void;
  /** AbortSignal aborted when the tool unmounts. */
  signal: AbortSignal;
  /** Persist / restore tool settings (IndexedDB, only if the user allows history). */
  loadSettings<T extends object>(defaults: T): Promise<T>;
  saveSettings(settings: object): void;
  /** Record a successful use in the local history. */
  recordUse(settings?: object): void;
}

export interface ToolModule {
  /** Render the tool into `root`. May return a cleanup function. */
  mount(root: HTMLElement, ctx: ToolContext): void | (() => void) | Promise<void | (() => void)>;
}

/** Result of processing a single file (used by batch runners). */
export interface OutputFile {
  name: string;
  blob: Blob;
  /** Optional human readable note, e.g. "−42 %". */
  note?: string;
}

/** A pure, UI-independent processing function used by batch tools. */
export type ProcessFn<O> = (
  file: File,
  options: O,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
) => Promise<OutputFile>;
