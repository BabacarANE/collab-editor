import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Collab Editor',
        short_name: 'Collab',
        description: 'Éditeur de texte collaboratif temps réel',
        theme_color: '#1a73e8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Mettre en cache les assets statiques
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Stratégie network-first pour les assets HTML
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Cache les assets statiques — cache-first
            urlPattern: /^https?.*\.(js|css|png|svg|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 jours
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {}
  }
})