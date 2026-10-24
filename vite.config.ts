import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
export default defineConfig({
  plugins: [react(), tailwind(), VitePWA({
    registerType: 'prompt',
    manifest: { name: 'Ontelier', short_name: 'Ontelier', description: 'An ontology workshop. Entirely on your device.', theme_color: '#FAF8F1', background_color: '#FAF8F1', display: 'standalone', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] },
    workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,wasm,txt,json}'], maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, navigateFallbackDenylist: [/^\/vendor\//], cleanupOutdatedCaches: true },
  })],
  server: { headers, host: '127.0.0.1' }, preview: { headers, host: '127.0.0.1' },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['oxigraph', 'rdf-reasoner-konclude'] },
});
