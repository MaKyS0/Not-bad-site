import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/tools.css';
import { initTheme } from './services/theme';
import { startApp } from './app';
import { preventWindowDrop } from './components/dropzone';
import { initSearchShortcut } from './components/searchDialog';
import { registerServiceWorker } from './services/sw';
import { toast } from './components/toast';
import { isAbort } from './utils/errors';

initTheme();
preventWindowDrop();
initSearchShortcut();

// Never leave the user with a white screen or a silent failure.
window.addEventListener('error', (e) => {
  // Ignore errors from extensions / cross-origin scripts without details.
  if (!e.error) return;
  console.error(e.error);
  toast('Something went wrong. Please try again or use another file.', 'error', 5000);
});
window.addEventListener('unhandledrejection', (e) => {
  if (isAbort(e.reason)) return;
  console.error(e.reason);
  toast('Something went wrong. Please try again or use another file.', 'error', 5000);
});

startApp();
registerServiceWorker();
