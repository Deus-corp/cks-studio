# CKS Studio Architecture

This document describes how CKS Studio is actually built, sync'd against
`src/` as of **v0.6.6**. It is the frontend counterpart to
[`cks-mcp/docs/architecture/ARCHITECTURE.md`](https://github.com/Deus-corp/cks-mcp/blob/main/docs/architecture/ARCHITECTURE.md)
and [`cks-runtime/docs/architecture/ARCH-001_Runtime_Architecture.md`](https://github.com/Deus-corp/cks-runtime/blob/main/docs/architecture/ARCH-001_Runtime_Architecture.md) —
those describe the backend that owns all knowledge and logic; this one
describes the thin, stateless client that reads and commands it.

---

## 1. High-Level Shape

```
┌──────────────────────────┐       MCP (JSON-RPC over HTTP)      ┌──────────────┐
│        CKS Studio        │ ◄──────────────────────────────────► │   cks-mcp    │
│   (React 19 SPA, Vite)   │         POST /mcp, tools/call        │  (Python)    │
└─────────────┬─────────────┘                                    └──────┬───────┘
              │                                                          │
              │ demo mode only                                          ▼
              ▼                                                  cks-runtime / cks-core
      mockClient.ts (in-memory,
      bundled ecosystem graph)
```

CKS Studio holds **no canonical knowledge and no business logic**. Every
piece of state that matters (objects, relations, versions, agent status,
LLM provider) is fetched from `cks-mcp` on demand and re-fetched or
optimistically reconciled after each mutation. The two exceptions —
`themeStore` (a UI preference) and `mockClient.ts` (the static demo's
fake backend) — are both explicitly local and never touch real CKS data.

---

## 2. Directory Structure

```
src/
├── App.tsx                  Router + top nav (7 routes, see §3)
├── main.tsx                 Real entry point — mounts <App/>
├── demo.tsx                 Static-demo entry point — mounts a
│                             restricted <App/> wired to mockClient
│                             (second Vite build target, see §7)
│
├── pages/                   One file per route, thin — wires a feature
│   ├── GraphPage.tsx           component to session/graph state
│   ├── PipelinePage.tsx
│   ├── GalleryPage.tsx
│   ├── DiffPage.tsx
│   ├── AgentsPage.tsx
│   ├── ChatsPage.tsx
│   └── SettingsPage.tsx
│
├── features/                 One directory per capability: component(s)
│   │                          + local Zustand store + hooks, colocated
│   ├── graph-explorer/          node/relation creation, layout, the
│   │                             graph's own Zustand store
│   ├── ai-chat/                  ChatPanel, chatStore, useAiChat
│   ├── agent-panel/              sweeper + standalone-process control
│   ├── graph-gallery/            public graph browser, galleryStore
│   ├── fork-diff/                CRDT fork comparison view
│   ├── version-diff/             explain_diff-based version comparison
│   ├── pipeline-monitor/         Researcher→Reviewer→Synthesizer→Arbiter
│   │                             live status
│   └── llm-status/               get_llm_status / list_llm_models hooks
│
├── components/
│   ├── graph/                2D (React Flow + Dagre) and 3D
│   │   │                     (3d-force-graph / Three.js) canvases,
│   │   │                     search palettes, legend, empty/skeleton
│   │   │                     states, node renderer, PNG/SVG export
│   │   └── nodes/CksNode.tsx    single generic node component, styled
│   │                             per CKS type via shared/constants
│   ├── layout/SidePanel.tsx  node inspector / property panel
│   ├── mcp/ConnectionStatus.tsx server/session connection indicator
│   └── common/                ErrorBoundary, LoadingSpinner,
│                               StatusBadge, HealthIndicator
│
├── services/                  Cross-feature infrastructure, not tied to
│   │                           any one page
│   ├── mcpClient.ts              raw JSON-RPC transport (callTool())
│   ├── mcpTools.ts                typed wrapper per cks-mcp tool used
│   │                               by the UI (~25 functions, see §5)
│   ├── sessionStore.ts            server URL + session id (Zustand,
│   │                               persisted, shared across all pages)
│   ├── connectionConfig.ts        localStorage read/write helpers for
│   │                               sessionStore + recent-sessions list
│   ├── mockClient.ts              demo-only fake callTool(), see §7
│   └── mockData.ts                the bundled ecosystem graph the
│                                   static demo serves
│
└── shared/                    Truly generic, feature-agnostic code
    ├── constants/                node type → colour/icon maps
    ├── stores/themeStore.ts      dark/light theme (Zustand, persisted)
    ├── types/                    graph.ts, pipeline.ts — CKS object/
    │                              tool-response shapes shared by 2+
    │                              features
    └── utils/                    graphUtils (CKS↔React Flow mapping,
                                   inference-chain tracing), graphExport
                                   (PNG/SVG), colorUtils, formatUtils
```

---

## 3. Routing & Navigation

`App.tsx` owns a single `BrowserRouter` with seven top-level routes,
each mapping directly to a `pages/*.tsx` file and a nav link:

| Route | Page | Feature(s) used |
|---|---|---|
| `/` | `GraphPage` | `graph-explorer`, `components/graph` (2D/3D) |
| `/pipeline` | `PipelinePage` | `pipeline-monitor` |
| `/gallery` | `GalleryPage` | `graph-gallery` |
| `/diff` | `DiffPage` | `version-diff`, `fork-diff` |
| `/agents` | `AgentsPage` | `agent-panel` |
| `/chat` | `ChatsPage` | `ai-chat`, `llm-status` |
| `/settings` | `SettingsPage` | `llm-status`, `shared/stores/themeStore` |

The static demo (`demo.tsx`) mounts a **restricted** version of the same
router: only `/`, `/gallery`, `/pipeline` are exposed (see §7) — Chat,
Agents, Diff, and Settings all require a live `cks-mcp` server and are
not reachable from the standalone build.

---

## 4. State Management

CKS Studio uses **Zustand**, one store per concern, no global store. All
stores follow the same shape: a `create<State>((set, get) => ({...}))`
call exported as a hook. None use Redux-style actions/reducers or
middleware beyond plain `set`/`get`.

| Store | Scope | Persisted? |
|---|---|---|
| `sessionStore` | server URL, session id, connection status, recent sessions | ✅ localStorage (`connectionConfig.ts`) |
| `themeStore` | dark/light preference | ✅ localStorage, falls back to `prefers-color-scheme` |
| `graphExplorerStore` | canvas nodes/edges, selection, highlight set, optimistic pending nodes/edges, relation-draft state | ❌ in-memory only |
| `galleryStore` | gallery query/filter state, loaded graphs, per-graph health (lazy) | ❌ in-memory only |
| `chatStore` | chat turns, raw `ai_chat` message history, selected model | ❌ in-memory only (module-level, so it survives page switches within a session but not a reload) |

**Why per-feature stores instead of one global store:** each store maps
to exactly one feature directory and is only imported by that feature's
components plus the one page that hosts it. This mirrors the
`features/` directory split and keeps a change to, say, the gallery's
filter state from needing to touch anything outside
`features/graph-gallery/`.

**Optimistic updates:** `graphExplorerStore` is the one store with
non-trivial mutation logic — `addPendingNode`/`commitPendingNode`/
`rollbackPendingNode` (and the edge equivalents) implement the
dashed-edge "pending" treatment mentioned in the ROADMAP: a locally
created node/edge renders immediately, then is committed (solid) or
rolled back (removed) once the corresponding `cks-mcp` call resolves.
This is local-only reconciliation against the studio's *own* mutations;
it does not yet reconcile against state changed by other sessions or
agents (see ROADMAP.md, "Real MCP Session Presence", P0).

---

## 5. MCP Client Layer

Two-layer design, both in `services/`:

1. **`mcpClient.ts`** — the only file that knows the wire format. A
   single `callTool(toolName, args)` function POSTs a JSON-RPC 2.0
   `tools/call` envelope to `{serverUrl}/mcp`, unwraps
   `result.content[0].text`, and `JSON.parse`s it. Also owns
   `setDemoCallTool()`, the seam the static demo uses to redirect every
   call to `mockClient.ts` instead of the network (see §7) — nothing
   outside `demo.tsx` calls this.

2. **`mcpTools.ts`** — one typed async function per `cks-mcp` tool the
   UI actually calls (~25 of the server's 63 tools; the rest are used
   only by LLMs directly, not by any studio page). Each wraps
   `callTool()` with a specific tool name, typed args, and a typed
   return shape — e.g. `querySubgraph()`, `evolveKnowledge()`,
   `listAgents()`, `startAgent()`, `aiChat()`, `getLLMStatus()`. Pages
   and feature hooks call these, never `callTool()` directly, so a
   change to one tool's response shape is a one-file fix.

No page or component holds a raw `fetch()` call to `cks-mcp` — everything
funnels through this layer, which is what makes the static demo's
single-seam swap (`setDemoCallTool`) possible in the first place.

---

## 6. Graph Rendering: 2D and 3D

`components/graph/` has two parallel canvas implementations sharing one
data-mapping layer:

- **2D — `GraphCanvas.tsx`**: React Flow for rendering/interaction,
  Dagre for automatic layout (`useGraphLayout.ts`, supports both
  top-to-bottom and left-to-right `rankdir`). This is the default and
  is always in the main bundle.
- **3D — `GraphCanvas3D.tsx`**: `3d-force-graph` (Three.js), force-directed
  layout, soft clustering by containing Component/Module, click-to-focus
  camera. **Lazy-loaded** via `React.lazy`/`Suspense` from `GraphPage.tsx`
  — the ~500 kB gzipped Three.js dependency is only fetched if the user
  switches to 3D mode.

Both canvases consume the same `Node[]`/`Edge[]` shape out of
`graphExplorerStore`, produced by `cksToReactFlow()` in
`shared/utils/graphUtils.ts` from a raw `query_subgraph`/`get_full_graph`
response. Feature parity between the two modes (path highlighting,
drag-and-drop import, Cmd/Ctrl+K search, relation-draft participant
picking) is maintained by routing both through this same shared
utility rather than duplicating the CKS→visual mapping per renderer.

---

## 7. Standalone Static Demo

`demo.tsx` is a **second Vite entry point** (see `vite.config.ts`),
built alongside the main app and deployed as `demo.html` under
`cks-website`'s GitHub Pages (`/cks-website/demo/demo.html` — the link
in the README's "Live demo" banner). It reuses the real page components
(`GraphPage`, `GraphGallery`, `PipelineMonitor`) so the demo cannot drift
from the actual studio UI; it differs from `main.tsx` only in:

- `mcpClient.setDemoCallTool()` redirects every `callTool()` to
  `mockClient.ts`, an in-memory MCP client serving the bundled ecosystem
  graph (`mockData.ts`) — no network call ever leaves the browser.
- `sessionStore` is pre-seeded with a fixed demo session so pages render
  connected immediately, instead of showing the "enter a session id"
  empty state.
- Navigation is restricted to Graph / Gallery / Pipeline — Chat, Agents,
  Diff, and Settings need a live `cks-mcp` server and are hidden.
- Gallery and Pipeline, which need live server data the mock client
  can't fabricate, render a static placeholder instead of an empty page.
- A floating "Back to Docs" link (`BackToDocsLink`) returns to the
  `cks-website` documentation root.

---

## 8. Design Tokens & Theming

A single Tailwind v4 `@theme` block in `styles/index.css` defines
`surface-0`…`surface-3`, `border`, `text`, and `accent` scales.
Components reference these tokens exclusively — no component hardcodes
a colour. `[data-theme="light"]` overrides the same variable names, so
`themeStore.applyTheme()` only ever needs to set one `data-theme`
attribute on `<html>` for the whole app to re-theme.

---

## 9. Tech Stack Reference

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| UI framework | React 19 |
| Build tool | Vite (two entry points: `main.tsx`, `demo.tsx`) |
| Routing | react-router-dom |
| Graph renderer (2D) | React Flow + Dagre |
| Graph renderer (3D) | `3d-force-graph` (Three.js), lazy-loaded |
| State management | Zustand (one store per feature, no global store) |
| Styling | Tailwind CSS v4, single design-token block |
| Testing | Vitest + React Testing Library |
| Linting / formatting | Biome |
| MCP transport | Hand-rolled JSON-RPC over `fetch` (`mcpClient.ts`); no `@modelcontextprotocol/sdk` dependency in the browser bundle |
| PWA | `vite-plugin-pwa` (web manifest, asset caching) |

> Note: `@modelcontextprotocol/sdk` appears in `package.json` but is not
> imported anywhere in `src/` — the actual browser transport is the
> hand-rolled `fetch`-based client in `mcpClient.ts` described in §5.
> `README.md`'s Tech Stack table has been corrected to match.
