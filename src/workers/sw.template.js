/* Universal File Toolbox — offline service worker.
 * Generated at build time: the version and precache placeholders below are replaced.
 * Never caches or sees user files: only GET requests for the app's own static
 * files are handled. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CORE_CACHE = `uft-core-${VERSION}`;
const RUNTIME_CACHE = `uft-runtime-${VERSION}`;
const SCOPE = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);
      // Add files one by one so a single failure does not abort the install.
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, SCOPE).href;
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res.ok) await cache.put(url, res);
          } catch (e) {
            /* ignore — will be fetched at runtime */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('uft-') && k !== CORE_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Cache by path only: query strings must not create unbounded cache entries. */
function cacheKey(request) {
  const url = new URL(request.url);
  return url.origin + url.pathname;
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(cacheKey(request), res.clone());
  }
  return res;
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const candidates = [url.href, url.href.endsWith('/') ? `${url.href}index.html` : `${url.href}/`];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(cacheKey(request), res.clone());
    }
    return res;
  } catch (e) {
    for (const c of candidates) {
      const hit = await caches.match(c, { ignoreSearch: true });
      if (hit) return hit;
    }
    const home = await caches.match(new URL('./', SCOPE).href);
    if (home) return home;
    return new Response('<h1>Offline</h1><p>This page is not available offline yet.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  // Speech models are cached by the recognition library itself (Cache API).
  if (url.href.startsWith(new URL('models/', SCOPE).href)) return;
  // The lyceum registry (/lyceum/) is a separate static app: never intercept it.
  if (url.href.startsWith(new URL('lyceum/', SCOPE).href)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
