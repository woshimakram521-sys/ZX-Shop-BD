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
          order: 'pre',
          handler() {
            const shimScript = `
      (function() {
        if (typeof window === 'undefined') return;

        var NativeWebSocket = window.WebSocket;
        if (NativeWebSocket) {
          function isViteWs(url, protocols) {
            if (protocols === 'vite-hmr') return true;
            if (Array.isArray(protocols) && protocols.indexOf('vite-hmr') !== -1) return true;
            if (typeof url === 'string' && (url.indexOf('token=') !== -1 || url.indexOf('vite') !== -1)) return true;
            return false;
          }

          function MockViteWebSocket(url, protocols) {
            if (!isViteWs(url, protocols)) {
              return new NativeWebSocket(url, protocols);
            }

            var target = new EventTarget();
            this._target = target;
            this.url = url;
            this.protocol = Array.isArray(protocols) ? protocols[0] : (protocols || 'vite-hmr');
            this.readyState = 1; // WebSocket.OPEN
            this.bufferedAmount = 0;
            this.extensions = '';
            this.binaryType = 'blob';

            this.onopen = null;
            this.onclose = null;
            this.onerror = null;
            this.onmessage = null;

            var self = this;
            setTimeout(function() {
              var evt = new Event('open');
              if (typeof self.onopen === 'function') {
                try { self.onopen.call(self, evt); } catch (e) {}
              }
              target.dispatchEvent(evt);
            }, 0);
          }

          MockViteWebSocket.CONNECTING = 0;
          MockViteWebSocket.OPEN = 1;
          MockViteWebSocket.CLOSING = 2;
          MockViteWebSocket.CLOSED = 3;

          MockViteWebSocket.prototype.CONNECTING = 0;
          MockViteWebSocket.prototype.OPEN = 1;
          MockViteWebSocket.prototype.CLOSING = 2;
          MockViteWebSocket.prototype.CLOSED = 3;

          MockViteWebSocket.prototype.send = function() {};
          MockViteWebSocket.prototype.close = function() {
            this.readyState = 3;
            var evt = new Event('close');
            if (typeof this.onclose === 'function') {
              try { this.onclose.call(this, evt); } catch (e) {}
            }
            this._target.dispatchEvent(evt);
          };
          MockViteWebSocket.prototype.addEventListener = function(type, listener, options) {
            this._target.addEventListener(type, listener, options);
          };
          MockViteWebSocket.prototype.removeEventListener = function(type, listener, options) {
            this._target.removeEventListener(type, listener, options);
          };
          MockViteWebSocket.prototype.dispatchEvent = function(event) {
            return this._target.dispatchEvent(event);
          };

          window.WebSocket = MockViteWebSocket;
        }

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
            if (e.preventDefault) e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            return true;
          }
        }, true);
        window.addEventListener('unhandledrejection', function(e) {
          var reason = e && (e.reason && e.reason.message || String(e.reason || ''));
          if (reason.indexOf('WebSocket') !== -1 || reason.indexOf('vite') !== -1) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            return true;
          }
        }, true);
      })();
`;
            return [
              {
                tag: 'script',
                children: shimScript,
                injectTo: 'head-prepend',
              },
            ];
          },
        },
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
      // HMR is disabled in AI Studio environment
      hmr: false,
      watch: null,
    },
  };
});
