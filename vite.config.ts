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
