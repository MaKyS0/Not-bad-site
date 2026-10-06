/**
 * Runtime base URL of the app.
 *
 * The production build uses a relative base ("./") unless BASE_PATH is set,
 * so the same build works at https://user.github.io/, at
 * https://user.github.io/repository/ or on any other host. The entry chunk
 * lives in <root>/assets/, therefore the app root is one level up from it.
 */
function computeBase(): string {
  if (import.meta.env.DEV) return new URL(import.meta.env.BASE_URL, location.origin).href;
  const configured = import.meta.env.BASE_URL;
  if (configured && configured.startsWith('/')) return new URL(configured, location.origin).href;
  return new URL('../', import.meta.url).href;
}

export const APP_BASE_URL = computeBase();
/** Path part of the base, always ending in "/". e.g. "/repository/" */
export const APP_BASE_PATH = new URL(APP_BASE_URL).pathname;

/** Build an absolute in-app path from a route like "tools/zip/". */
export const href = (route = ''): string => APP_BASE_PATH + route.replace(/^\/+/, '');

/** Strip the base from a pathname, returning the in-app route without leading slash. */
export function routeOf(pathname: string): string {
  if (pathname.startsWith(APP_BASE_PATH)) return pathname.slice(APP_BASE_PATH.length);
  return pathname.replace(/^\/+/, '');
}

export const assetUrl = (path: string): string => new URL(path.replace(/^\/+/, ''), APP_BASE_URL).href;
