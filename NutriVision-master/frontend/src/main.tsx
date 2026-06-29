import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  let swReg: ServiceWorkerRegistration | null = null;

  window.addEventListener('load', async () => {
    try {
      swReg = await navigator.serviceWorker.register('/sw.js');

      swReg.addEventListener('updatefound', () => {
        const newSW = swReg!.installing;
        if (!newSW) return;

        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sw-update'));
          }
        });
      });
    } catch { /* SW not available */ }
  });

  window.addEventListener('pwa-activate-update', () => {
    if (swReg?.waiting) {
      swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  });
}
