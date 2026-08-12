# ADR-003: Graph Gallery

**Status:** Implemented — see `src/features/graph-gallery/`, shipped
before v0.5.1 and stable since; health-score badge added alongside.
**Related:** cks-mcp Memory Agent tools (`list_graphs`, `search_graphs`,
`register_graph`, `check_graph_health`), `docs/architecture.md` §2.

## Context

A `session_id` on its own is an opaque string — there was no way to
discover which graphs existed on a given `cks-mcp` server, whether a
graph was meant to be shared, or how healthy it was, short of already
knowing the id and calling `query_subgraph` blind. `cks-mcp`'s Memory
Agent already exposes a graph registry (`register_graph`, `list_graphs`,
`search_graphs`, `check_graph_health`) for exactly this purpose, but
nothing in the studio surfaced it.

## Decision

### 1. A dedicated feature + store, read-only against the registry

`GraphGallery.tsx` + `galleryStore.ts` own gallery state independently
of `sessionStore` — browsing the gallery does not require an active
session, and selecting a graph card only calls `sessionStore`'s
`setSessionId()` once, on open, rather than keeping the two stores
in sync continuously.

### 2. Query vs. list is resolved client-side, not by always searching

`galleryStore.load()` calls `searchGraphs()` when there's a non-empty
query string and `listGraphs()` otherwise, both parameterised by the
same `tag`/`publicOnly` filters. This keeps the empty-query "browse
everything public" case a plain list call instead of a search over an
empty string.

### 3. Health score is lazy, per-card, not eager for the whole list

`check_graph_health` is a separate call per graph name and is not
cheap to run for every card on page load. `loadHealth(name)` is only
triggered by an explicit user action per card (see `HealthBadge` /
`HealthIndicator`), tracked independently in
`health: Record<name, result>` and `healthLoading: Record<name, boolean>`
so one card's health check in flight doesn't block or reset another's.

### 4. Opening a graph is a session-store handoff, not a gallery-owned view

`GraphCard`'s "Open in Graph" sets `sessionStore.sessionId` to the
selected `graph.session_id` and navigates to `/` (`GraphPage`) — the
gallery does not render any graph preview itself. This keeps exactly
one code path responsible for turning a `session_id` into a rendered
graph (`GraphPage` + `graphExplorerStore`), whether the id came from
a URL, a typed input, or a gallery card.

## Consequences

- Health scores can go stale between a user's checks — there's no
  polling or invalidation; a "Refresh" re-check is a repeat of the same
  manual action, not an automatic background job (unlike agent/process
  status, see ADR-004).
- The `tag`/`publicOnly` filters are the only structured filters today;
  ROADMAP.md's "Graph Gallery: Clone & Fork" P1 item adds
  category/date/popularity filtering on top of this same store shape.
