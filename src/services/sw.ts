import { APP_BASE_URL } from '../utils/base';
import { toast } from '../components/toast';
import { t } from '../i18n/i18n';

/** Register the offline service worker (production builds only). */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', APP_BASE_URL).href, { scope: APP_BASE_URL })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              toast(t('A new version is available — it will be used after you reload.'), 'info', 6000);
            } else if (worker.state === 'activated' && !navigator.serviceWorker.controller) {
              toast(t('Ready to work offline.'), 'success');
            }
          });
        });
      })
      .catch((e) => console.warn('Service worker registration failed', e));
  });

  const offlineToast = () => toast(t('You are offline. Cached tools keep working.'), 'info');
  window.addEventListener('offline', offlineToast);
}
