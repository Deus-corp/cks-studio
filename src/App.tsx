import { lazy, Suspense } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LogoMenu } from '@/components/layout/LogoMenu'
import { ConnectionStatus } from '@/components/mcp/ConnectionStatus'
import { GraphPage } from './pages/GraphPage'

// GraphPage ("/") is the default landing route and is kept mounted for
// the app's whole lifetime (see AppContent below), so it's imported
// eagerly. Every other page -- and everything it pulls in (GraphGallery
// + compare/merge UI, VersionDiff, DeadLetterPanel, RunHistoryPanel,
// AgentsPage, ChatsPage/QuickAiPanel's full chat view, SettingsPage) --
// is only reachable by navigating to it, so each gets its own chunk via
// React.lazy and is fetched on first visit rather than shipping in the
// main entry bundle.
const PipelinePage = lazy(() =>
  import('./pages/PipelinePage').then((m) => ({ default: m.PipelinePage })),
)
const GalleryPage = lazy(() =>
  import('./pages/GalleryPage').then((m) => ({ default: m.GalleryPage })),
)
const DiffPage = lazy(() =>
  import('./pages/DiffPage').then((m) => ({ default: m.DiffPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AgentsPage = lazy(() =>
  import('./pages/AgentsPage').then((m) => ({ default: m.AgentsPage })),
)
const DeadLetterPage = lazy(() =>
  import('./pages/DeadLetterPage').then((m) => ({
    default: m.DeadLetterPage,
  })),
)
const ChatsPage = lazy(() =>
  import('./pages/ChatsPage').then((m) => ({ default: m.ChatsPage })),
)

const NAV_LINKS = [
  { to: '/', label: 'Graph', nav: 'graph' },
  { to: '/pipeline', label: 'Pipeline', nav: 'pipeline' },
  { to: '/gallery', label: 'Gallery', nav: 'gallery' },
  { to: '/diff', label: 'Diff', nav: 'diff' },
  { to: '/agents', label: 'Agents', nav: 'agents' },
  { to: '/dead-letter', label: 'Dead Letter', nav: 'dead-letter' },
  { to: '/chat', label: 'Chat', nav: 'chat' },
  { to: '/settings', label: 'Settings', nav: 'settings' },
]

function NavBar() {
  const { pathname } = useLocation()

  return (
    <nav className="flex items-center gap-1 bg-surface-1/90 backdrop-blur border-b border-border-subtle px-4 py-2 sticky top-0 z-20">
      <div className="mr-4">
        <LogoMenu />
      </div>

      <div className="flex items-center gap-0.5">
        {NAV_LINKS.map(({ to, label, nav }) => {
          const isActive =
            to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              data-nav={nav}
              aria-current={isActive ? 'page' : undefined}
              // Color/background for the active and hover states come
              // from the --nav-tint custom property set per data-nav
              // value in styles/index.css, so each destination gets its
              // own hue instead of one repeated accent (bg-surface-2).
              className={`relative text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                isActive ? 'text-text-primary' : 'text-text-secondary'
              }`}
            >
              {label}
              {isActive && (
                <span className="nav-underline absolute left-2.5 right-2.5 -bottom-[9px] h-0.5 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>

      <div className="ml-auto">
        <ConnectionStatus />
      </div>
    </nav>
  )
}

/** Minimal loading state for lazy-loaded pages -- shown only for the
 *  brief window while a route's chunk is fetched (typically already
 *  cached after the first visit). Deliberately plain rather than
 *  reusing GraphSkeleton, which is shaped around the graph canvas. */
function PageLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="h-full flex items-center justify-center text-text-tertiary text-sm"
    >
      Loading…
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 min-h-0">
          <AppContent />
        </div>
      </div>
    </BrowserRouter>
  )
}

/** Keeps GraphPage permanently mounted instead of letting react-router
 *  unmount/remount it on every navigation away from and back to "/".
 *  GraphPage's *data* (nodes/edges/session) already lives in zustand
 *  stores that survive unmounting fine, but its *view* state doesn't:
 *  - GraphCanvas3D builds a fresh three.js/3d-force-graph scene per
 *    mount, so the force simulation restarts from scratch (nodes spawn
 *    at random positions and animate into place -- the "graph unfurls
 *    again" effect) and the camera resets to its default position,
 *    every single time you navigate away and back.
 *  - GraphPage's `selectedNode` (what SidePanel shows) is local
 *    useState, not store state, so it's lost outright on unmount --
 *    whatever node you had open before leaving is gone when you return.
 *  Rendering GraphPage unconditionally and toggling visibility with
 *  `hidden` (rather than routing it through <Routes>) keeps all of that
 *  state -- physics-settled node positions, camera, focus mode,
 *  selected node -- alive across tab switches, so returning to "/"
 *  looks exactly like you left it instead of restarting. `hidden` was
 *  chosen over unmounting-and-caching-state because the simulation
 *  itself (not just the data) needs to keep existing for this to work;
 *  reconstructing it from saved positions on every remount would be
 *  more code for a strictly worse result (still restarts the WebGL
 *  context, still pays 3d-force-graph's init cost, still needs to
 *  re-seed a great deal of internal simulation state that isn't
 *  actually exposed to reset from outside).
 *  Every other page keeps its original mount-on-navigate behavior
 *  (via <Routes> below) -- this is deliberately scoped to the one page
 *  that actually asked for it, not a blanket "keep everything alive"
 *  change to the rest of the app. */
export function AppContent() {
  const { pathname } = useLocation()
  const isGraphRoute = pathname === '/'

  return (
    <div className="h-full relative">
      <div className={isGraphRoute ? 'h-full' : 'hidden'}>
        <ErrorBoundary>
          <GraphPage />
        </ErrorBoundary>
      </div>
      <div className={isGraphRoute ? 'hidden' : 'h-full'}>
        {/* key={pathname} forces a remount of the boundary (and its
         *  subtree) on every route change, so an error caught on one
         *  page doesn't keep showing the fallback after navigating
         *  away to a different, unrelated page -- the user would
         *  otherwise have to click "Try again" first. */}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/diff" element={<DiffPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/dead-letter" element={<DeadLetterPage />} />
              <Route path="/chat" element={<ChatsPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
