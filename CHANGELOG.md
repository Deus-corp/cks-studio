# Changelog

All notable changes to CKS Studio will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

---

## [0.5.0] - 2026-08-09

### Added
- **AI Chat panel** – talk to an LLM directly from the studio; the LLM can call `ai_chat`-scoped tools to read and mutate the graph. Includes collapsible tool-call disclosure and live graph refresh after mutating calls.
- **`useAiChat` hook** and **`chatStore`** – manage conversation state and sync graph after tool calls.
- **New fonts** – self-hosted Manrope (display) and JetBrains Mono (mono) for improved visual hierarchy.
- **Graph node redesign** – subtler top-accent bar instead of full border, refined spacing and typography.
- **Directional arrowheads** on graph edges – filled arrow markers so relation direction reads at a glance.
- **Type legend** visual refresh with icons and semi-transparent glow.
- New unit tests for `toolCallsMutatedGraph`.

### Changed
- Graph canvas hover effect softened (brightness lift instead of box-shadow).
- Edge labels use mono font and background padding for readability.
- Marker color updates dynamically with highlight state.

---

## [0.4.0] - 2026-08-09

### Added
- **Agent Control Panel** – Start/Stop in‑process sweepers and Request Stop for standalone agents directly from the Agent Panel, using `start_agent`, `stop_agent`, and `request_process_stop` MCP tools.
- **Dark theme** – design tokens (`surface-0`…`surface-3`, `border`, `text`, `accent`), graph-paper background texture, subtle glow, and scrollbar styling applied globally.
- **Logo mark** – minimal SVG logo in the navigation bar.
- **Keyboard focus indicators** – `:focus-visible` styles for better accessibility.
- **Connection status moved to navbar** – now visible on every page.

### Changed
- Navigation bar redesigned with active state indicators and sticky positioning.
- `GraphPage` header simplified (ConnectionStatus moved to navbar).
- `SettingsPage` placeholder updated to reflect current state.
- `AgentPanel` UI refreshed with consistent design tokens and button interactions.

---

## [0.3.3] - 2026-08-09

### Added
- **Standalone-agent visibility in Agent Panel** – now displays Critic, Enrichment, Fork Resolution, and Pipeline Agent processes from the shared `cks_agent_liveness` table, alongside the existing sweeper cards.
- **`useProcessesPolling` hook** – polls `list_processes` with visibility pause and race-safe request sequencing.
- **`ProcessCard` component** – shows process kind, PID, hostname, heartbeat/started times, status (alive/stopped), and current task.
- **`listProcesses` and `getProcessStatus` functions** in `mcpTools.ts` – typed wrappers.
- **Tests** – 9 UI tests for `AgentPanel`, 6 hook tests for `useProcessesPolling`, and `test/setup.ts` cleanup registration to enable multiple renders per test file.

---

## [0.3.2] - 2026-08-09

### Added
- **Agents page** – displays the status of all in‑process sweepers (contradiction, inference staleness, provenance staleness, temporal staleness, graph freshness, graph auto‑update, graph health) using `list_agents` and `agent_status` MCP tools.
- **AgentPanel component** – shows agent id, running status, interval, last run time (relative), duration, result count, and last error for each sweeper.
- **`useAgentsPolling` hook** – polls agent status at a configurable interval, pauses when the browser tab is hidden.
- **`listAgents` and `getAgentStatus` functions** in `mcpTools.ts` – typed wrappers around the new MCP tools.
- **`formatRelativeTime` utility** – displays timestamps as "3m ago", "2h ago", etc., for agent last run times.

---

## [0.3.1] - 2026-08-09

### Added
- **Object creation form** – add new nodes directly from the studio with optimistic UI and error feedback.
- **Relation creation form** – select source/target nodes on canvas and define a relation type.
- **Optimistic updates** – new nodes/edges appear immediately (dashed/pending style) and are rolled back on failure.
- **Relation draft mode** – visual picker for selecting relation participants with amber highlight.
- **`useEvolveMutation` hook** – reusable hook for `evolve_knowledge` calls with diagnostics handling.
- **Recent sessions** – stores last 5 connected sessions in `localStorage` for quick switching.

### Changed
- `GraphPage` uses `CreateMode` switch (`none` | `node` | `relation`) instead of a boolean.
- `GraphCanvas` and `CksNode` support relation draft mode and pending states.
- `graphExplorerStore` extended with pending and relation draft state.
- `mcpTools` exports `evolveKnowledge` with proper error discrimination.

---

## [0.3.0] - 2026-08-08

### Added
- **Version Diff** – compare the current session state with any previous version (via `explain_diff`), with color-coded object/relation changes and summary counters.
- **Export graph to PNG / SVG** – buttons in the top-right corner of the canvas, using `html-to-image`.
- **Type legend** – shows the color mapping for CKS object types (Definition, Claim, Fork, etc.) in the bottom-left corner.
- **Drag-and-drop subgraph JSON files** – drop a `query_subgraph` export directly onto the canvas to load it.
- **Shortest path highlighting** – `Shift+click` two nodes to highlight the path between them (BFS over all edges).
- **Recent sessions** – a dropdown in the header remembers the last 5 connected session/server pairs (stored in `localStorage`).
- **Reset graph** – clears the canvas to start fresh.
- New tests for `findPathBetweenNodes`, `graphExport`, `versionDiffUtils`.

### Changed
- `GraphPage` now auto-connects when a `sessionId` is already present (e.g., from Gallery).
- `traceInferenceChain` now highlights all incoming edges, not just `depends_on`.

---

## [0.2.0] - 2026-08-08

### Added
- **Graph Gallery** – browse public graphs from `graph_registry` (Memory Agent v1/v2), with search, tag filtering, and lazy health score checks via `check_graph_health`.
- **Pipeline Monitor** – Kanban board showing objects by their `current_status` (Researcher → Reviewer, ADR-007 Milestone 1), with auto-refresh and transition log inspector.
- **Global session store** – `useSessionStore` persists server URL and session ID to `localStorage`, shared across all pages.
- **Navigation bar** – quick switching between Graph, Pipeline, Gallery, and Settings pages.
- **`normalizeCompactSubgraphResponse`** – adapter for `query_subgraph`'s compact mode format, correctly unwrapping nodes/edges from `subgraph` envelope.
- **Session connection status** – idle/connecting/connected/error states reflected in UI.
- **`ErrorBoundary`** – catches render errors in any page and shows a fallback instead of a white screen.
- **`ConnectionStatus` component** – colour-coded indicator for MCP server connectivity.
- **Shared utilities** – `colorUtils.ts`, `formatUtils.ts`, `nodeTypes.ts` to avoid duplication across features.
- New tests for gallery utilities, pipeline utilities, session store, and MCP tools.

### Changed
- **Refactored `CksNode` and `SidePanel`** to use shared constants and utility functions instead of inline colour/icon maps.
- **Removed empty placeholder files** (`GraphControls`, `SemanticEdge`, individual node type files, unused feature folders) to reduce noise.
- **`vitest` setup** now loads `@testing-library/jest-dom` matchers for all tests.
- **`query_subgraph` compact_mode nodes** are now treated as canonical `{identity, structure}` objects (backend no longer sends flat `{id, type, name, props}`).

### Fixed
- **`formatStatusLabel`** centralised formatting of pipeline status labels (snake_case → readable), fixing inconsistency between graph nodes and side panel.

---

## Notes

This is the first public reference implementation of the CKS Studio Standard.