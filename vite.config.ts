import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Seminex',
        short_name: 'Seminex',
        description: 'Join seminars, scan in, and get your certificate.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#7A1C1C',
        background_color: '#FAF8F5',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache strategy, in one place:
        // 1. The built app (scripts, styles, icons, self-hosted fonts) is precached, so every screen
        //    and the static Registration guidelines page open without a connection.
        // 2. There is no runtime caching of API calls. Saved seminars, tickets, and the profile live
        //    in src/api/offlineCache.ts, which the API client reads when a request fails.
        // 3. Actions that change data are never queued; the pages show a message instead.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Serve index.html for any navigation so client routes work offline.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});