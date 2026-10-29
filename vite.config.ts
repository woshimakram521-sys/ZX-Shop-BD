import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'hmr-suppressor',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            const shimScript = `\n    <script>
      (function() {
        if (typeof window === 'undefined') return;
        var origConsoleError = console.error;
        console.error = function() {
          var args = Array.prototype.slice.call(arguments);
          var str = args.map(function(a) { return (a && a.message) || String(a || ''); }).join(' ');
          if (str.indexOf('WebSocket') !== -1 || str.indexOf('[vite]') !== -1 || str.indexOf('vite:ws') !== -1) {
            return;
          }
          return origConsoleError.apply(console, args);
        };
        window.addEventListener('error', function(e) {
          var msg = (e && e.message) || '';
          var filename = (e && e.filename) || '';
          if (msg.indexOf('WebSocket') !== -1 || filename.indexOf('@vite/client') !== -1 || msg.indexOf('vite') !== -1) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);
        window.addEventListener('unhandledrejection', function(e) {
          var reason = e && (e.reason && e.reason.message || String(e.reason || ''));
          if (reason.indexOf('WebSocket') !== -1 || reason.indexOf('vite') !== -1) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);
        var NativeWebSocket = window.WebSocket;
        if (NativeWebSocket) {
          window.WebSocket = function(url, protocols) {
            var urlStr = String(url || '');
            var protoStr = Array.isArray(protocols) ? protocols.join(',') : String(protocols || '');
            var isViteHmr = protoStr.indexOf('vite') !== -1 || urlStr.indexOf('token=') !== -1 || urlStr.indexOf('@vite') !== -1;
            if (isViteHmr) {
              var target = new EventTarget();
              var mockWs = {
                url: urlStr,
                readyState: 1,
                CONNECTING: 0,
                OPEN: 1,
                CLOSING: 2,
                CLOSED: 3,
                protocol: 'vite-hmr',
                extensions: '',
                bufferedAmount: 0,
                binaryType: 'blob',
                send: function() {},
                close: function() {},
                addEventListener: function(type, listener, options) {
                  target.addEventListener(type, listener, options);
                  if (type === 'open') {
                    setTimeout(function() {
                      try {
                        var ev = new Event('open');
                        target.dispatchEvent(ev);
                        if (typeof mockWs.onopen === 'function') mockWs.onopen(ev);
                      } catch (_) {}
                    }, 0);
                  }
                },
                removeEventListener: function(type, listener, options) {
                  target.removeEventListener(type, listener, options);
                },
                dispatchEvent: function(event) {
                  return target.dispatchEvent(event);
                },
                onopen: null,
                onclose: null,
                onerror: null,
                onmessage: null
              };
              setTimeout(function() {
                try {
                  var ev = new Event('open');
                  target.dispatchEvent(ev);
                  if (typeof mockWs.onopen === 'function') mockWs.onopen(ev);
                } catch (_) {}
              }, 0);
              return mockWs;
            }
            return new NativeWebSocket(url, protocols);
          };
          window.WebSocket.prototype = NativeWebSocket.prototype;
          window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
          window.WebSocket.OPEN = NativeWebSocket.OPEN;
          window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
          window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
        }
      })();
    </script>\n`;
            return html.replace(/<head[^>]*>/i, function(match) { return match + shimScript; });
          }
        }
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'ZX Shop – অনলাইন শপ',
          short_name: 'ZX Shop',
          description: 'ZX Shop - আপনার পছন্দের অনলাইন শপ। দ্রুত হোম ডেলিভারি, ক্যাশ অন ডেলিভারি, বিকাশ ও নগদ পেমেন্ট সুবিধা।',
          theme_color: '#e11d48',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var or in Cloud Run proxy environment.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: (process.env.DISABLE_HMR === 'true' || Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB)) ? false : true,
      // Disable file watching when DISABLE_HMR is true or in Cloud Run container.
      watch: (process.env.DISABLE_HMR === 'true' || Boolean(process.env.K_SERVICE)) ? null : {},
    },
  };
});
