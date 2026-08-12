# ADR-004: Agent Observability & Control Panel

**Status:** Implemented — see `src/features/agent-panel/`, shipped
before v0.5.1.
**Related:** cks-runtime ADR-015 (Sweeper Control), cks-runtime ADR-016
(Agent Process Control), cks-mcp's `list_agents`/`agent_status`/
`start_agent`/`stop_agent`/`list_processes`/`process_status`/
`request_process_stop` tools, ADR-001 §1 (same "background agents the
Agent Panel already controls" reference point).

## Context

`cks-mcp` runs two different kinds of background agent, and before this
feature neither was visible or controllable from the studio at all:

1. **In-process sweepers** (Contradiction, Inference/Provenance/Temporal
   Staleness, Graph Freshness, Graph Health, ...) — run inside the
   `cks-mcp` server process itself, on a periodic schedule.
2. **Standalone processes** (Critic, Enrichment, Fork Resolution,
   Pipeline Agent) — separate long-running processes started manually,
   reporting liveness via heartbeat.

Both needed the same three things a human operator wants: "is it
running", "what did it just do", and "can I stop/start it from here
instead of a terminal". They needed it via different `cks-mcp` tool
pairs (`list_agents`/`start_agent`/`stop_agent` vs. `list_processes`/
`request_process_stop`) because they're different subsystems on the
backend (see cks-runtime ADR-015 vs ADR-016).

## Decision

### 1. One page, two sections, two tool families — not unified into one

`AgentPanel.tsx` renders sweepers and standalone processes as two
distinct sections rather than merging them into a single list. This
mirrors the backend split instead of hiding it: sweepers support
`start_agent`/`stop_agent` (they can be toggled), standalone processes
only support `request_process_stop` (graceful shutdown request — they
are "started manually" outside the studio, noted directly in the UI
copy, and the studio cannot start one).

### 2. Polling, not push — with a shared, duplicated-by-design pattern

Live status uses `useAgentsPolling` / `useProcessesPolling`, two
near-identical hooks (10s interval, `document.visibilityState`-gated —
polling pauses when the tab isn't visible so a backgrounded tab doesn't
keep hammering the server for nothing) rather than a single generic
polling hook, because the two feeds have different response shapes
(`AgentStatus[]` vs `ProcessStatus[]`) and independent race-guard
sequence numbers. See `docs/architecture.md` — this predates any
WebSocket/SSE push mechanism; ROADMAP.md's "Real MCP Session Presence"
P0 item covers replacing this polling pattern for the graph canvas, and
would apply here too if extended.

### 3. Request-response race protection via a sequence counter

Both polling hooks guard against out-of-order responses (a slower
earlier request resolving after a faster later one) with a local
`requestSeq` ref incremented per call; a response is only applied if
its sequence still matches the latest issued request. This matters
specifically because polling plus manual "Refresh" clicks plus
start/stop actions can all trigger overlapping in-flight requests.

### 4. Errors are three-way, not binary

Both the UI and the polling hooks distinguish three states that a
naive `error: string | null` would conflate: **not yet loaded**
(empty array, no fetch completed), **loaded and genuinely empty** (no
sweepers enabled, or no process has ever sent a heartbeat), and
**fetch/protocol error** (network failure, bad response). Collapsing
these would make "no sweepers configured" indistinguishable from "the
studio can't reach cks-mcp".

## Consequences

- Two hooks with ~90% identical bodies is accepted duplication, not an
  oversight — see §2. A shared generic polling hook was considered and
  rejected because the race-guard and response-shape differences would
  need generics or a type union either way, for little real reduction
  in code.
- Sweeper status here can lag up to the poll interval (10s) behind
  reality; this is acceptable for an operator dashboard, not acceptable
  for anything safety-critical — no such use is made of this data.
