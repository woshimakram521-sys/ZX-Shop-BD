import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Safely ignore WebSocket disconnection errors from dev HMR proxies
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (msg.includes('WebSocket')) {
      event.preventDefault();
    }
  });
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (msg.includes('WebSocket')) {
      event.preventDefault();
    }
  });
}

registerSW({immediate: true});

createRoot(document.getElementById('root')!).render(<App />);

