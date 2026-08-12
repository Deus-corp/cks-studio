# ADR-005: Standalone Static Demo

**Status:** Implemented — see `demo.html`, `src/demo.tsx`,
`src/services/mockClient.ts`, `src/services/mockData.ts`; shipped
v0.6.5–v0.6.6.
**Related:** `docs/architecture.md` §7, README.md "Live demo" banner.

## Context

Trying CKS Studio previously required running a local `cks-mcp` server
first — `npm install`, configure a provider, `npm run mcp`, then
`npm run dev`. That's a reasonable bar for a contributor but too high
for anyone just evaluating whether the ecosystem is worth the setup at
all. The project already had a ready-made answer for what to show:
`scripts/import-ecosystem-graph.*` builds a real knowledge graph of the
CKS project itself (277 objects, 158 relations) that the README already
recommends as the first thing to explore locally.

## Decision

### 1. A second Vite entry point, not a separate deployment

`vite.config.ts` builds two HTML entry points from one codebase —
`index.html` (the real studio) and `demo.html` (the static demo) — in
the same `npm run build`. `demo.tsx` reuses the actual page components
(`GraphPage`, `GraphGallery`, `PipelineMonitor`) rather than building
demo-specific views, so the demo cannot visually drift from the real
studio the way a hand-maintained screenshot or separate mini-app would.

### 2. The mock lives at the transport seam, not scattered through pages

`mcpClient.ts` exposes `setDemoCallTool()` as the single point where
every `callTool()` invocation can be redirected. `demo.tsx` calls this
once, before any page mounts, to route all traffic to
`mockClient.ts` — an in-memory MCP client serving the bundled
`mockData.ts` ecosystem graph. No page or feature component has any
awareness that it's running in demo mode; they call the same
`mcpTools.ts` functions either way.

### 3. Navigation and pages that need a live server are pared down, not hidden entirely

Chat, Agents, Diff, and Settings all depend on real-time server state
(LLM provider status, live sweeper heartbeats, session-scoped version
history) that a static mock can't fabricate meaningfully, so the
demo's nav only exposes Graph / Gallery / Pipeline. Gallery and
Pipeline *are* kept in the nav — but since they also need live data the
mock can't produce, they render a static placeholder
(`UnavailableInDemo`) instead of an empty or broken page, so the demo
still reads as "the full studio interface, with some sections clearly
marked as needing a server" rather than a cut-down preview product.

### 4. Relative asset base, because the demo is mounted under a subpath

`base: './'` in `vite.config.ts` — the demo is embedded under
`cks-website`'s GitHub Pages deployment at
`/cks-website/demo/demo.html`, not domain root. An absolute base bakes
root-relative asset URLs into the built HTML, which 404s the instant
the page isn't served from the domain root; this was an actual
production incident (see the `demo.tsx` comment on the leftover
service-worker cleanup, item below) before the fix. The relative base
keeps every asset URL resolved against `demo.html`'s own location, so
one build works at any mount point — the real studio's `index.html`
included, whatever origin it ends up deployed at.

### 5. PWA service worker is registered only on the real app, not the demo

`vite-plugin-pwa`'s default `injectRegister: 'auto'` would inject a
service-worker registration `<script>` into *every* HTML entry,
including `demo.html`. A stale worker from a previous (possibly
broken) deploy takes over the page via `skipWaiting()`/
`clientsClaim()` and keeps serving its own cached assets straight past
later redeploys — this is exactly what happened once the absolute-base
bug above shipped, and the fix required a `serviceWorker.getRegistrations()`
self-cleanup on the demo entry point for anyone who'd hit the broken
build to self-heal on their next visit. Registration (`injectRegister:
false` in the plugin config, manual `<script>` in `index.html` only)
is now scoped to the real app; the offline-install PWA experience
isn't meaningful for a demo the user isn't installing.

## Consequences

- The demo will silently go stale relative to `mockData.ts` if the real
  `cks-ecosystem` graph structure changes significantly and nobody
  re-runs `scripts/import-ecosystem-graph.*` to refresh the bundled
  snapshot — there's no automated sync between the live registry graph
  and the demo's static copy.
- Any new page added to the real studio needs an explicit decision
  (nav-visible + real, nav-visible + placeholder, or hidden) for the
  demo — there's no default; §3's three-way split has to be applied by
  hand each time.
