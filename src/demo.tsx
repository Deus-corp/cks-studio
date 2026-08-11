// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Entry point for the static demo (public/demo.html), built as a second
 * Vite entry (see vite.config.ts). Reuses the real page components --
 * GraphPage, PipelineMonitor, GraphGallery -- so the demo never drifts
 * from the actual studio UI. The only differences from src/main.tsx:
 *
 *  - mcpClient's callTool() is redirected to mockClient (no server call
 *    ever leaves the browser);
 *  - sessionStore is preloaded with a fixed demo session so pages render
 *    immediately instead of showing an empty "connect" state;
 *  - the nav only exposes Graph / Gallery / Pipeline -- Chat, Agents,
 *    Evolve and Diff all require a live cks-mcp server and are hidden;
 *  - a banner explains this is a static demo;
 *  - a floating "Back to Docs" link returns to the cks-website docs site;
 *  - Gallery and Pipeline, which need a live cks-mcp server for real data,
 *    show a static placeholder instead of an empty/broken page.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { GraphPage } from './pages/GraphPage'
import { setDemoCallTool } from './services/mcpClient'
import { DEMO_SESSION, callTool as mockCallTool } from './services/mockClient'
import { useSessionStore } from './services/sessionStore'
import './styles/index.css'
import './styles/graph.css'

// Earlier builds of this demo let vite-plugin-pwa auto-register a service
// worker on this page too (see vite.config.ts for why that's no longer
// done). That worker's skipWaiting()+clientsClaim() meant it took over
// the page immediately and kept serving its own cached (and, in the
// broken-base-path build, permanently 404ing) assets straight through
// later redeploys -- no amount of fixing the source or rebuilding was
// visible in an already-affected browser until the old worker was
// cleared. Best-effort cleanup so anyone who hit that build self-heals
// on their next visit instead of needing to know to clear site data.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
      }
    })
    .catch(() => {
      // Best-effort only -- an unregister failure shouldn't block the
      // demo from rendering.
    })
}

// Route every callTool() through the mock client for the lifetime of this
// page -- must happen before any page component mounts and fires its
// first request.
setDemoCallTool(mockCallTool)

// Preload the session store so GraphPage/GalleryPage/PipelinePage think
// they're already connected to `demo-ecosystem`, instead of showing the
// "enter a session id" empty state on first paint.
useSessionStore.setState({
  serverUrl: DEMO_SESSION.serverUrl,
  sessionId: DEMO_SESSION.sessionId,
  status: 'connected',
  error: null,
})

const DEMO_NAV_LINKS = [
  { to: '/', label: 'Graph' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/pipeline', label: 'Pipeline' },
]

// Where the docs site is mounted (see astro.config.mjs `base`). The demo
// is embedded under /cks-website/demo/, so this is a relative hop back up
// to the docs root rather than a hardcoded absolute origin.
const DOCS_HOME_URL = '/cks-website/'

function BackToDocsLink() {
  return (
    <a
      href={DOCS_HOME_URL}
      className="fixed top-3 left-3 z-30 flex items-center gap-1.5 bg-surface-1/90 backdrop-blur border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-2 text-xs px-3 py-1.5 rounded-full shadow-sm transition-colors"
    >
      <span aria-hidden="true">←</span>
      Back to Docs
    </a>
  )
}

/** Placeholder shown for demo pages that need a live cks-mcp server to
 *  show anything meaningful (Gallery lists registered graphs across
 *  sessions, Pipeline streams live sweeper/agent activity -- neither
 *  exists in a single bundled static graph). Keeping the routes and nav
 *  entries in place, instead of hiding them, means the demo still reads
 *  as the full studio interface rather than a cut-down preview. */
function UnavailableInDemo({ title }: { title: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h2 className="text-text-primary font-display font-semibold text-sm mb-2">
          {title}
        </h2>
        <p className="text-text-secondary text-xs leading-relaxed">
          This section is not available in the static demo. Run cks-mcp locally
          to see live data.
        </p>
      </div>
    </div>
  )
}

function DemoBanner() {
  return (
    <div className="bg-accent/10 border-b border-accent/30 text-text-primary text-xs px-4 py-2 text-center">
      This is a static demo of CKS Studio, showing the cks-ecosystem graph only.
      AI Chat, Agents and Evolve need a running server.{' '}
      <a
        href="https://github.com/Deus-corp/cks-studio"
        className="underline hover:text-accent-strong"
        target="_blank"
        rel="noreferrer"
      >
        Run cks-mcp locally and connect the studio
      </a>{' '}
      for full functionality.
    </div>
  )
}

function DemoNavBar() {
  const { pathname } = useLocation()
  return (
    <nav className="flex items-center gap-1 bg-surface-1/90 backdrop-blur border-b border-border-subtle px-4 py-2 sticky top-0 z-20">
      <Link
        to="/"
        className="mr-4 text-text-primary font-display font-bold text-sm tracking-tight"
      >
        CKS Studio -- Demo
      </Link>
      <div className="flex items-center gap-0.5">
        {DEMO_NAV_LINKS.map(({ to, label }) => {
          const isActive =
            to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={`relative text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                isActive
                  ? 'text-text-primary bg-surface-2'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/60'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// HashRouter, not BrowserRouter: demo.html is a single static file with no
// server-side rewrite rules on GitHub Pages, so client routes must live in
// the URL fragment (demo.html#/gallery) to survive a reload or direct link.
function DemoApp() {
  return (
    <HashRouter>
      <div className="h-screen flex flex-col">
        <BackToDocsLink />
        <DemoBanner />
        <DemoNavBar />
        <div className="flex-1 min-h-0">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<GraphPage />} />
              <Route
                path="/gallery"
                element={<UnavailableInDemo title="Graph Gallery" />}
              />
              <Route
                path="/pipeline"
                element={<UnavailableInDemo title="Pipeline Monitor" />}
              />
            </Routes>
          </ErrorBoundary>
        </div>
      </div>
    </HashRouter>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
)
