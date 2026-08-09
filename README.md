# CKS Studio

> Interactive visual workspace for the Canonical Knowledge Structure ecosystem.

![TypeScript](https://img.shields.io/badge/typescript-5.7%2B-blue)
![React](https://img.shields.io/badge/react-55-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-alpha-orange)

**CKS Studio** is the graphical interface of the CKS ecosystem — a
single-page application where you can **explore knowledge graphs**,
**inspect inference chains**, **review CRDT forks**, **monitor agent
pipelines**, and **browse the public graph gallery**, all connected to
one or more `cks-mcp` servers over the Model Context Protocol (MCP).

It complements the three backend repositories by providing a visual
layer that makes the canonical knowledge immediately accessible to
humans, while remaining fully driven by the same MCP tools available to
LLMs.

---

# Ecosystem

CKS Studio completes the CKS toolchain:

| Project | Description | Repository |
|---------|-------------|------------|
| **cks-core** | Canonical semantic engine. | [Deus-corp/cks-core](https://github.com/Deus-corp/cks-core) |
| **cks-runtime** | Operational environment – sessions, transactions, persistence. | [Deus-corp/cks-runtime](https://github.com/Deus-corp/cks-runtime) |
| **cks-mcp** | MCP server – exposes CKS to LLMs and agents. | [Deus-corp/cks-mcp](https://github.com/Deus-corp/cks-mcp) |
| **cks-studio** | Visual workspace – explore, monitor, and manage graphs. | [Deus-corp/cks-studio](https://github.com/Deus-corp/cks-studio) |

---

# Why CKS Studio?

`cks-mcp` already gives LLMs 53+ tools to create, validate, evolve, and
query knowledge structures. But humans and operators also need to see
what the agents are doing — to inspect a graph visually, to compare
forked versions of an object, or to watch a multi‑step reasoning
pipeline unfold.

CKS Studio is that human window:

- **Interactive graph exploration** — zoom, pan, drill‑down by clicking
  on nodes, all with automatic layout.
- **Inference chain inspector** — follow `depends_on` edges from a
  conclusion back to its axioms.
- **CRDT fork diff** — compare conflicting object versions side‑by‑side
  with colour‑coded branches.
- **Pipeline monitor** — see the status of objects moving through
  Researcher → Reviewer → Synthesizer → Arbiter steps.
- **Graph gallery** — browse public knowledge graphs registered by the
  community or your team.
- **Agent control panel** — start, stop, and observe the autonomous
  agents (Critic, Enrichment, Fork Resolution, Pipeline).
- **Agent observability** — monitor the status of all background sweepers
  (contradiction, staleness, health, etc.) in real time via the Agents page.

---

# Architecture

CKS Studio is a thin, stateless frontend. All knowledge and logic live
in the backend; the studio only reads and sends commands through MCP.

```
┌──────────────────┐       MCP (JSON-RPC)        ┌──────────────┐
│   CKS Studio     │ ◄─────────────────────────► │   cks-mcp    │
│  (React SPA)     │        HTTP / stdio         │  (Python)    │
└──────────────────┘                             └──────┬───────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │ SQLite /     │
                                                 │ Postgres     │
                                                 └──────────────┘
```

- **MCP Client layer** – typed wrappers around `tools/call` for every
  CKS tool.
- **State management** – Zustand stores keep the UI in sync with the
  backend.
- **Visualisation** – React Flow + Dagre for the graph canvas, custom
  nodes for different CKS object types.
- **Pipeline monitor** — watch objects move through Researcher → Reviewer steps with live auto-refresh.
- **Graph gallery** — search, filter, and inspect public graphs registered via `register_graph`.

---

# Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| UI framework | React 19 |
| Build tool | Vite |
| Graph renderer | React Flow + Dagre |
| State management | Zustand |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + React Testing Library |
| Linting / formatting | Biome |
| MCP transport | `@modelcontextprotocol/sdk` (HTTP + stdio) |

---

# Quick Start

> **Prerequisites:** Node.js ≥ 20, a running `cks-mcp` instance
> (with HTTP transport enabled).

```bash
git clone https://github.com/Deus-corp/cks-studio.git
cd cks-studio
npm install
cp .env.example .env.local   # edit the MCP server URL
npm run dev
```

Open `http://localhost:5173` and enter a `session_id` or browse the
public gallery.

### Demo: Explore the CKS Ecosystem Graph

We ship a pre-built knowledge graph of the entire CKS project
(277 objects, 158 relations). To see it in one command:

```bash
# Terminal 1: Start the MCP server
npm run mcp

# Terminal 2: Import the ecosystem graph (registers it in the Gallery)
npm run mcp:import-ecosystem

# Terminal 3: Launch the studio
npm run dev
```

Open `http://localhost:5173`, go to the **Gallery** tab, and click
**Open in Graph** on the `cks-ecosystem` card. The full project
architecture appears instantly — no configuration needed.

---

# Project Status

CKS Studio is in **active early development**. The MVP delivers
read‑only graph exploration with drill‑down. Subsequent milestones add
inference chain inspection, fork diff, pipeline monitoring, and the
gallery.

| Feature | Status |
|---------|--------|
| Graph exploration (query_subgraph) | ✅ Complete |
| Custom nodes (Definition, Claim, Fork, Resolution) | ✅ Complete |
| Inference chain inspector | ✅ Complete |
| CRDT fork diff view | ✅ Complete |
| Pipeline monitor | ✅ Complete |
| Graph gallery | ✅ Complete |
| Agent observability (list_agents) | ✅ Complete |
| Agent control panel | 📅 Planned |

---

# Roadmap

- **v0.1** – Read‑only graph explorer with automatic layout.
- **v0.2** – Inference chain inspector.
- **v0.3** – Fork diff view (LCA comparison).
- **v0.4** – Pipeline monitor (transition_log visualisation).
- **v0.5** – Graph gallery + agent control panel.

---

# Contributing

Contributions are welcome! Please open an issue to discuss what you’d
like to work on. See the [CKS Core repository](https://github.com/Deus-corp/cks-core)
for the overall project conventions.

---

# License

MIT
