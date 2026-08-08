# Changelog

All notable changes to CKS Studio will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

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