# ADR-002: 3D Graph View

**Status:** Implemented — see `src/components/graph/GraphCanvas3D.tsx`,
shipped v0.6.0–v0.6.4.
**Related:** ADR-001 (AI Assistant Chat Panel — same "thin client, reuse
existing stores" pattern), `docs/architecture.md` §6.

## Context

The 2D canvas (`GraphCanvas.tsx`) lays out the graph with Dagre using a
top-to-bottom or left-to-right `rankdir`. Dagre puts every node that
shares a rank in a single row (or column). For CKS graphs specifically,
this is a recurring shape: many `Tool` objects implementing one `ADR`,
or many `Relation` objects attached to one `Component`, all land on the
same rank. The result is a graph that reads as a very wide, very short
ribbon — most of the canvas is empty vertical space, and the nodes that
actually need to be compared are far apart horizontally.

Node/edge counts in these graphs (hundreds of objects for something
like the `cks-ecosystem` demo graph — 277 objects, 158 relations) are
not the problem; the 2D layout's inability to use more than one
dimension for same-rank spreading is.

## Decision

### 1. A second canvas, not a replacement

`GraphCanvas3D.tsx` is a parallel implementation, not a mode of
`GraphCanvas.tsx`. Both read from the same `graphExplorerStore` and
accept the same `onNodeSelect` contract, so `GraphPage.tsx` only needs
a `viewMode` toggle (`'2d' | '3d'`, persisted in `graphExplorerStore`)
and a conditional render — no store or data-fetching duplication.

### 2. `3d-force-graph` (Three.js) for rendering

Force-directed layout spreads nodes over a volume instead of a plane,
so a "many nodes, one rank" graph becomes a roughly spherical cluster
instead of a stretched ribbon. Node sizing is degree-based (more edges
→ larger sphere), so hub objects like `cks-mcp` or `cks-runtime` read
as visually important without any manual annotation.

### 3. Lazy-loaded, not in the main bundle

The Three.js dependency chain is large (~500 kB gzipped). Since 2D is
the default view and most sessions may never touch 3D, `GraphPage.tsx`
imports `GraphCanvas3D` via `React.lazy()` behind a `Suspense` boundary
that reuses the existing `GraphSkeleton` fallback — switching to 3D for
the first time in a session pays a one-time chunk fetch; every other
page load that stays in 2D pays nothing.

### 4. Feature parity is maintained explicitly, not incidentally

Because the two canvases don't share rendering code, parity between
them is a deliberate, tracked list rather than automatic:

| Capability | 2D | 3D |
|---|---|---|
| Always-visible labels | ✅ | ✅ |
| Degree-based node sizing | — (fixed size) | ✅ |
| Hover neighbour-highlighting | ✅ | ✅ |
| Path highlighting (Shift+click) | ✅ | ✅ |
| Drag-and-drop `.json` subgraph import | ✅ | ✅ |
| Relation-draft participant picking | ✅ | ✅ |
| Cmd/Ctrl+K search palette | ✅ (`GraphSearchPalette`) | ✅ (`GraphSearchPalette3D`, separate component) |
| MiniMap | ✅ | ❌ not ported |
| Manual node drag-to-reposition | ✅ | ❌ not applicable — 3D nodes are simulation-driven |
| Soft clustering by containing Component/Module | — | ✅ |
| Layout direction toggle (TB/LR) | ✅ | — not applicable (force-directed, no rank axis) |

Each new capability added to one canvas should be triaged against this
table rather than assumed to transfer.

### 5. Clustering derived from `contains` edges, not a separate call

`GraphCanvas3D` computes each node's nearest containing Component/Module
by walking `contains` edges already present in the fetched subgraph
(see `computeClusters` in the component) — no additional `cks-mcp`
tool call is made to support clustering. Nodes with no containing
ancestor (most `ADR`s, `Relation`s) are simply left out of the
clustering force and still participate in the normal charge/link
forces.

## Consequences

- Two renderers to keep in sync (§4's table) is real, ongoing
  maintenance cost — a new 2D-only feature is easy to ship without
  noticing the 3D gap until someone files it.
- The lazy-load boundary means the first 3D toggle in a session has a
  visible load delay; this is treated as an acceptable trade against
  never taxing the 2D-only majority of sessions.
- 3D mode has no minimap and no manual repositioning by design, not
  oversight — both are 2D-specific interaction patterns without a
  faithful 3D-force-graph equivalent.
