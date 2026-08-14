# Roadmap

This roadmap outlines the planned evolution of CKS Studio, the visual
workspace for the Canonical Knowledge Structure ecosystem. It reflects
the current state of the project and charts the course towards a
production-ready, real-time visual layer over `cks-mcp`.

---

# Current Status (v0.6.25 — August 2026)

CKS Studio is now a full visual workspace and control surface:

- 2D/3D graph views with degree-based node sizing, focus modes, multi-select, fullscreen, search palette, and type filtering.
- Persistent graph state across tab navigation — the 3D scene and camera no longer reset.
- Start Pipeline button for selected graph objects.
- Dead Letter inbox UI with approve/reject.
- Agent observability and control panels.
- AI Chat with model selector.
- Graph Gallery and Version Diff views.
- PWA support.
- Fully static demo with mock Gallery/Agents/Chat/Settings pages.

## ✅ Completed Milestones

- 2D/3D graph explorer.
- Cmd/Ctrl+K search palette.
- Node type filter and collapsible type legend.
- Degree-based node sizing and degree badges in both 2D and 3D.
- 2D/3D focus modes with opt-in toggles.
- Multi-select with Ctrl/Cmd+click and selection rings.
- Start Pipeline button using `start_pipeline` MCP tool.
- Dead Letter inbox page with `review_dead_letter`, `approve_resolution`, `reject_resolution`.
- Inference Chain Inspector.
- CRDT Fork Diff View.
- Version Diff.
- Agent/Pipeline monitoring and control.
- Graph Gallery.
- AI Chat panel.
- PWA support.
- Static demo with mock pages for Gallery, Agents, Chat, Settings.

### Inspection & Review
- Inference Chain Inspector — trace `depends_on` from a conclusion
  back to its axioms.
- CRDT Fork Diff View — LCA-based comparison of conflicting branches.
- Version Diff — current session state vs. any past version
  (`explain_diff`).

### Monitoring & Control
- Pipeline Monitor — live status of objects moving through the
  Researcher → Reviewer → Synthesizer → Arbiter pipeline, transition
  log per object.
- Agent Observability — real-time status of every background sweeper
  (contradiction, inference/provenance/temporal staleness, graph
  freshness, graph health) via `list_agents` / `agent_status`.
- Agent Control Panel — start/stop in-process sweepers and request
  graceful shutdown of standalone agents (Critic, Enrichment, Fork
  Resolution, Pipeline Agent) via `start_agent` / `stop_agent` /
  `request_process_stop`.

### Discovery & Collaboration
- Graph Gallery — search, filter, and inspect public graphs registered
  via `register_graph`.
- AI Chat panel — LLM assistant scoped to the current session, can
  call the same MCP tools to read and mutate the graph, with a
  collapsible tool-call disclosure and live graph refresh.

### Platform & Design
- Design token system (`surface-0`…`surface-3`, `border`, `text`,
  `accent`) driving both dark (default) and light
  (`[data-theme="light"]`) themes.
- Dark/light toggle on the Settings page, persisted per device,
  defaults to `prefers-color-scheme` on first visit.
- Self-hosted variable fonts (Manrope, JetBrains Mono), graph-paper
  background texture, `:focus-visible` accessibility styling.
- English-only UI strings (remaining Russian JSDoc comments are
  developer-facing only, not user-visible).
- **PWA support** — installable as a standalone desktop app from
  Chrome/Edge/Safari, web manifest, static asset caching.

### Standalone Demo
- **Static, no-server demo** (`demo.html`) — the bundled CKS ecosystem
  graph rendered entirely client-side via a mock MCP client
  (`mockClient.ts`); restricted nav (Graph / Gallery / Pipeline),
  placeholder pages for the tabs that need a live server, and a
  floating "Back to Docs" link back to the documentation site. Built
  as a second Vite entry point alongside the main studio, so it never
  drifts from the real UI.

---

# Next Up

## Real MCP Session Presence (🟢 in progress)

- SSE subscription to session events so agents mutate the graph and the UI updates without manual refresh — done: `src/services/sessionEvents.ts` + `useSessionEvents.ts`, wired into `GraphPage` (debounced, coalesced refresh via the existing `getFullGraph` load path; no-ops in the static demo). Backend endpoint lives in cks-mcp (`GET /events`, see its ROADMAP).
- Still open: presence indicators for other connected sessions/agents.

## Graph Gallery: Clone & Filters (🟡 P1)

- Clone a public graph into the user's own session.
- Filters by category, tags, date, popularity.
- Health score badge on gallery cards.

## Pipeline Orchestrator UI (🟡 P1)

- Run history and logs per pipeline execution.
- Visual pipeline builder.

## Conflict Resolution UI (🟢 P2)

- Gossip conflict inspector: highlight conflicting nodes/edges on the canvas.

## Accessibility & Performance (🟢 P2)

- Code-splitting for AI Chat, Gallery, export.
- Full keyboard navigation of the graph canvas.
- Virtualised MiniMap/legend for large graphs.

## Desktop Application (🔵 P3)

- Single installer bundling `cks-studio` + `cks-mcp` + `cks-core` + `cks-runtime`.

---

# Beyond

- **Real-time collaborative graph editing** via CRDT gossip, multiple
  cursors on the same canvas.
- **Plugin marketplace** — surface `list_plugins` results as
  installable/configurable panels inside the studio.
- **Federated graph search** across multiple registered `cks-mcp`
  servers from a single gallery view.
- **Domain-specific canvas themes** — layout and iconography presets
  for science/law/medicine constraint packs as `cks-mcp` grows domain
  packs.

---

## Operational Notes

- CKS Studio is a pure frontend: it has no knowledge or business logic
  of its own, everything shown here depends on the corresponding
  `cks-mcp` tool already existing and reachable over HTTP. Roadmap
  items above are UI/UX work on top of tools that already exist in
  `cks-mcp`, except where explicitly noted as needing a new tool.
- See [docs/architecture.md](docs/architecture.md) for how the frontend
  itself is structured (routing, state, MCP client layer, 2D/3D
  rendering, the static demo build), and [docs/adr/](docs/adr/) for the
  design rationale behind individual features referenced above.
- See [cks-mcp's ROADMAP](https://github.com/Deus-corp/cks-mcp/blob/main/ROADMAP.md)
  for backend-side work (e.g. the LCA Arbiter) that some of the items
  above build on.
