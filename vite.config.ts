import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Both index.html (main studio) and demo.html (static demo embedded
  // under cks-website's /cks-website/demo/) are served from whatever
  // subpath their host deploys them at, not necessarily domain root. An
  // absolute base (Vite's default '/') bakes root-relative asset URLs
  // like "/assets/demo-*.js" into the built HTML, which 404s the moment
  // the page isn't served from the domain root -- exactly what happened
  // with demo.html under GitHub Pages' /cks-website/demo/ path. A
  // relative base keeps every asset URL resolved against the HTML file's
  // own location instead, so the same build works at any mount point.
  base: './',
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
      // Default 'auto' injects a <script> that registers the service
      // worker into *every* HTML entry point, including demo.html. That
      // SW's skipWaiting()+clientsClaim() means a stale worker from a
      // previous (possibly broken) deploy takes over the page and keeps
      // serving its own cached assets straight past any later redeploy,
      // completely hiding fixes until the user manually clears it. The
      // offline-install PWA experience is only meaningful for the real
      // studio app (index.html) -- the static demo doesn't need it and
      // shouldn't pay this cost. Registration is added manually to
      // index.html only; see demo.tsx for the matching cleanup that
      // unregisters any worker left over from before this change.
      injectRegister: false,
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
