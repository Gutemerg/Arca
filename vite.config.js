import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg}'] },
      manifest: {
        name: 'Arca',
        short_name: 'Arca',
        description: 'Tudo da sua vida em um só lugar.',
        lang: 'pt-BR',
        start_url: '/#/hoje',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F5F7',
        theme_color: '#F4F5F7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Capturar', short_name: 'Capturar', url: '/#/capturar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Finanças', short_name: 'Finanças', url: '/#/financas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }
        ],
        share_target: {
          action: '/#/capturar',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' }
        }
      }
    })
  ]
});
