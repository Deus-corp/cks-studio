
---

## [0.2.0] - 2026-08-08

### Added
- **Graph Gallery** – browse public graphs from `graph_registry` (Memory Agent v1/v2), with search, tag filtering, and lazy health score checks via `check_graph_health`.
- **Pipeline Monitor** – Kanban board showing objects by their `current_status` (Researcher → Reviewer, ADR-007 Milestone 1), with auto-refresh and transition log inspector.
- **Global session store** – `useSessionStore` persists server URL and session ID to `localStorage`, shared across all pages.
- **Navigation bar** – quick switching between Graph, Pipeline, Gallery, and Settings pages.
- **`normalizeCompactSubgraphResponse`** – adapter for `query_subgraph`'s compact mode format, correctly unwrapping nodes/edges from `subgraph` envelope.
- **Session connection status** – idle/connecting/connected/error states reflected in UI.
- New tests for gallery utilities, pipeline utilities, session store, and MCP tools.