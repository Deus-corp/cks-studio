import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We ship our own hand-authored public/manifest.webmanifest verbatim
      // (linked from index.html) instead of having the plugin generate one,
      // so its content stays exactly what was specified rather than
      // whatever shape vite-plugin-pwa's manifest option would produce.
      manifest: false,
      includeAssets: ['icon-192.png', 'icon-512.png'],
      registerType: 'autoUpdate',
      workbox: {
        // Precache only the build's own static output (JS/CSS/HTML/fonts/
        // icons) -- never runtime responses. Deliberately no
        // `runtimeCaching` entries for '/mcp': every MCP request is a
        // same-origin fetch the service worker's fetch handler never
        // intercepts a route for, so it always goes straight to the
        // network and is never served from (or written to) the cache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // Belt-and-braces: even the SPA navigation fallback (used for
        // client-side routes like /settings on a hard reload) must never
        // catch a request under /mcp.
        navigateFallbackDenylist: [/^\/mcp\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // Second entry point for the static demo (src/demo.tsx / demo.html
      // at repo root, next to index.html -- must live there, not under
      // public/, so Vite actually transforms its <script src> and bundles
      // demo.tsx rather than copying the file verbatim). Built alongside
      // the main studio bundle, output as dist/demo.html.
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        demo: path.resolve(import.meta.dirname, 'demo.html'),
      },
    },
  },
})
