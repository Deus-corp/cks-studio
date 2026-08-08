# Roadmap

CKS Studio is the visual workspace for the Canonical Knowledge Structure ecosystem.

## v0.1 — Graph Explorer (current)
- ✅ Interactive graph canvas with React Flow + Dagre
- ✅ Custom nodes (Definition, Claim, Fork, Resolution)
- ✅ Drill-down (click to expand neighbourhood)
- ✅ Inference Chain Inspector
- ✅ Fork Diff View
- ✅ Pipeline status badges

## v0.2 — Real MCP Integration
- 🔲 HTTP transport in `cks-mcp`
- 🔲 Replace mock data with live `query_subgraph`, `explain_inference`, `list_gossip_conflicts`
- 🔲 Session selector (connect to running `cks-mcp`)

## v0.3 — Agent Control Panel
- 🔲 Start/stop autonomous agents (Critic, Enrichment, Fork Resolution, Pipeline)
- 🔲 Live outbox queue viewer

## v0.4 — Graph Gallery
- 🔲 Browse public graphs from `graph_registry`
- 🔲 Clone a graph into your own session

## v0.5 — Pipeline Orchestrator UI
- 🔲 Visual pipeline builder (drag & drop steps)
- 🔲 Pipeline run history and logs

## v0.6 — Desktop Application (Electron)
- 🔲 Single installer bundling `cks-studio` + `cks-mcp` + `cks-core` + `cks-runtime`
- 🔲 One-click start for local knowledge management

## Beyond
- 🔲 Real-time collaboration via CRDT gossip
- 🔲 Plugin marketplace
- 🔲 Federated graph search