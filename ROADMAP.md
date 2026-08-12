# Roadmap

This roadmap outlines the planned evolution of CKS Studio, the visual
workspace for the Canonical Knowledge Structure ecosystem. It reflects
the current state of the project and charts the course towards a
production-ready, real-time visual layer over `cks-mcp`.

---

# Current Status (v0.6.6 — August 2026)

CKS Studio has grown from a read-only graph viewer into a full
**human control surface for the CKS ecosystem**: graph exploration with
type filtering and quick-jump search in both 2D and 3D, inference and
fork inspection, pipeline and agent monitoring with live control, a
public gallery, an AI chat panel wired to the same MCP tools an LLM
would use, an installable PWA, a standalone no-server demo, and a
dark/light theme built on a single token system. 81 tests, TypeScript
strict mode, Biome-enforced formatting.

## ✅ Completed Milestones

### Graph Canvas
- Interactive graph canvas — React Flow + Dagre automatic layout.
- Custom nodes for every CKS object type (Definition, Claim, Concept,
  Fork, Resolution), colour- and icon-coded by type, status dot for
  pipeline state.
- Drill-down — click a node to expand its neighbourhood
  (`query_subgraph`).
- **Cmd/Ctrl+K search palette** — fuzzy match on label/id, arrow-key
  navigation, centres the viewport on the selected node.
- **Type filter** — legend doubles as a checkbox filter; hidden types
  and their edges are dropped before layout.
- **MiniMap coloured by type**, matching the main canvas and legend.
- **Empty state** and **skeleton loading** — the canvas now always
  explains what's happening instead of showing a blank rectangle.
- Drag-and-drop import of `query_subgraph` `.json` exports.
- PNG/SVG graph export.
- Path highlighting between two nodes (Shift+click).
- **2D/3D view toggle** — force-directed 3D canvas (`3d-force-graph` /
  Three.js) as an alternative to the 2D Dagre layout, useful for wide
  graphs with many same-rank nodes. Feature parity with 2D: path
  highlighting, drag-and-drop import, participant picking, and
  Cmd/Ctrl+K search. Lazy-loaded (React.lazy + Suspense) so the
  default 2D-only view never pays the Three.js bundle cost. Nodes are
  softly clustered by containing Component/Module.
- **Layout direction toggle** (2D) — top-to-bottom or left-to-right
  Dagre layout for handling wide graphs.

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

## Real MCP Session Presence (🔴 P0)

**Goal:** Make the canvas reflect what's actually happening on the
server in real time, not just on the actions a user takes locally.

- [ ] **WebSocket/SSE subscription** to session events so a graph
  mutated by an agent or another user updates without a manual
  `query_subgraph` re-fetch.
- [ ] **Optimistic-update reconciliation** — the existing pending-node
  / pending-edge dashed-edge treatment already covers local
  create/evolve calls; extend it to reconcile against server-pushed
  state instead of only the local mutation's own response.
- [ ] **Presence indicators** — show which other sessions/agents are
  currently connected to the same `session_id`.

## Graph Gallery: Clone & Fork (🟡 P1)

- [ ] **Clone a public graph** into the user's own session instead of
  only viewing it read-only.
- [ ] **Filters** by category, tags, date, popularity in the Gallery
  search bar.
- [ ] **Health score badge** on gallery cards, sourced from
  `check_graph_health`.

## Pipeline Orchestrator UI (🟡 P1)

- [ ] **Visual pipeline builder** — drag-and-drop `AgentStep`
  configuration instead of editing `cks-pipeline-agent` config by
  hand.
- [ ] **Run history and logs** view per pipeline execution.

## Conflict Resolution UI (🟢 P2)

- [ ] **Dead-letter review queue** — surface
  `list_dead_lettered_conflicts` with `approve_resolution` /
  `reject_resolution` actions directly from the studio, instead of
  only via raw tool calls.
- [ ] **Gossip conflict inspector** — visualise
  `list_gossip_conflicts` / `list_inference_conflicts` on the graph
  canvas (highlight the conflicting nodes/edges in place).

## Accessibility & Performance (🟢 P2)

- [ ] **Code-splitting** — the 3D graph module (Three.js) is already
  lazy-loaded; extend the same treatment to the AI Chat, Gallery, and
  export (`html-to-image`) code paths, which still ship in the main
  bundle.
- [ ] **Full keyboard navigation** of the graph canvas (tab through
  nodes, arrow-key pan) for parity with mouse/touch interaction.
- [ ] **Virtualised MiniMap/legend** for graphs with 500+ distinct
  types.

## Desktop Application (🔵 P3)

- [ ] Single installer (Electron or Tauri) bundling `cks-studio` +
  `cks-mcp` + `cks-core` + `cks-runtime` for one-click local knowledge
  management, no `npm install`/`pip install` required.

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
