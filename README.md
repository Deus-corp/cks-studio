# CKS Studio

> Interactive visual workspace for the Canonical Knowledge Structure ecosystem.

![TypeScript](https://img.shields.io/badge/typescript-5.7%2B-blue)
![React](https://img.shields.io/badge/react-19-61DAFB)
![Tests](https://img.shields.io/badge/tests-261%20passed-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-v0.16.1-orange)

> 🚀 **[Live demo →](https://deus-corp.github.io/cks-website/demo/demo.html)** — explore the CKS ecosystem graph directly in your browser, no server required.

**CKS Studio** is the graphical interface of the CKS ecosystem — a
single-page application where you can **explore knowledge graphs**,
**inspect inference chains**, **review CRDT forks**, **monitor agent
pipelines**, **browse the public graph gallery**, and **chat with an
LLM** that can call tools and modify the graph, all connected to one
or more `cks-mcp` servers over the Model Context Protocol (MCP).

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
| **cks-website** | Documentation & demo site. | [Deus-corp/cks-website](https://github.com/Deus-corp/cks-website) |

📖 **Full documentation, case studies, and an interactive demo**
are available at the **[CKS Documentation Site](https://deus-corp.github.io/cks-website/)**.

---

# Quick Start

> **Prerequisites:** Node.js ≥ 20, a running `cks-mcp` instance
> (with HTTP transport enabled).

```bash
git clone https://github.com/Deus-corp/cks-studio.git
cd cks-studio
npm install
cp .env.example .env.local   # edit the MCP server URL
npm run dev
```

Open `http://localhost:5173` and enter a `session_id`, or browse the
public gallery.

### Demo: explore the CKS Ecosystem Graph

We ship a pre-built knowledge graph of the entire CKS project
(277 objects, 158 relations). To see it in one command:

```bash
# Terminal 1: start the MCP server
npm run mcp

# Terminal 2: import the ecosystem graph (registers it in the Gallery)
npm run mcp:import-ecosystem

# Terminal 3: launch the studio
npm run dev
```

Open `http://localhost:5173`, go to the **Gallery** tab, and click
**Open in Graph** on the `cks-ecosystem` card. The full project
architecture appears instantly — no configuration needed.

### Install as Desktop App (PWA)

Open the studio in Chrome/Edge and click the install icon in the address bar,
or use "Install CKS Studio" from the browser menu. The app will open in its
own window and work offline for previously loaded assets.

---

### AI Chat: talk to your graph with a free LLM

You can use the AI Chat panel with **any OpenAI‑compatible provider**.  
Here's how to start **for free**, using OpenRouter:

1. **Get a free API key** at [openrouter.ai](https://openrouter.ai) (no
   credit card required).

2. **Start the server** with the free Laguna XS 2.1 model:
   ```bash
   CKS_LLM_PROVIDER=openai_compatible \
   CKS_OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
   CKS_OPENAI_API_KEY=sk-or-v1-... \
   CKS_OPENAI_MODEL=poolside/laguna-xs-2.1:free \
   npm run mcp
   ```

3. **Open the studio**, connect to a session, switch to the **Chat** tab,
   and ask «What objects are in this session?» — the LLM will call
   `query_subgraph` and describe your graph.

The same setup works with **any** model on OpenRouter, Together AI, Groq,
or a local Ollama server. Only the `CKS_OPENAI_*` variables change — the
studio itself never talks to the LLM directly, so there's zero
configuration on the frontend side.

---

# Why CKS Studio?

`cks-mcp` already gives LLMs 63 tools to create, validate, evolve, and
query knowledge structures. But humans and operators also need to see
what the agents are doing — to inspect a graph visually, to compare
forked versions of an object, or to watch a multi-step reasoning
pipeline unfold.

CKS Studio is that human window:

- **Interactive graph exploration** — zoom, pan, and drill down by
  clicking on nodes, with automatic Dagre layout.
- **2D / 3D graph views** — toggle to a force-directed 3D canvas
  (Three.js) for wide graphs with many same-rank nodes; path
  highlighting, drag-and-drop import, and Cmd/Ctrl+K search all work
  in both modes.
- **Cmd/Ctrl+K quick jump** — fuzzy search across every node on the
  canvas by name or id, keyboard-navigable, centres the viewport on the
  match. No more scrolling a large graph to find one node.
- **Type filter** — click a type in the legend to hide/show every node
  of that type, so a dense graph can breathe.
- **Inference chain inspector** — follow `depends_on` edges from a
  conclusion back to its axioms.
- **CRDT fork diff** — compare conflicting object versions side by side
  with colour-coded branches.
- **Pipeline monitor** — see the status of objects moving through
  Researcher → Reviewer → Synthesizer → Arbiter steps.
- **Graph gallery** — browse public knowledge graphs registered by the
  community or your team.
- **Agent control panel** — start/stop in-process sweepers and request
  graceful shutdown of standalone agents directly from the UI.
- **Agent observability** — monitor the status of all background
  sweepers (contradiction, staleness, health, etc.) in real time via
  the Agents page.
- **AI Chat** — built-in assistant that can answer questions, create
  objects, evolve the graph, and explain its reasoning, all scoped to
  the current session.
- **Dark and light themes** — a single set of design tokens driving
  both; respects your OS preference on first visit, remembered after.
- **Import subgraphs by drag-and-drop** — drop a `query_subgraph`
  `.json` export straight onto the canvas.
- **AI Chat with any LLM** — a built‑in assistant that can read, query, and
  evolve the knowledge graph. Works with **any** OpenAI‑compatible provider
  (OpenAI, Anthropic, Groq, Together AI, OpenRouter) and even with
  **free models** like `poolside/laguna-xs-2.1` via OpenRouter.
- **Standalone static demo** — the full CKS ecosystem graph rendered
  entirely in-browser (`demo.html`), no `cks-mcp` server required;
  used for the live demo linked at the top of this README.

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
- **State management** – Zustand stores (`graphExplorerStore`,
  `sessionStore`, `themeStore`, ...) keep the UI in sync with the
  backend and with user preferences.
- **Graph layout** – React Flow for rendering/interaction, Dagre for
  automatic layout, custom nodes per CKS object type.
- **Design tokens** – a single Tailwind v4 `@theme` block
  (`surface-0`…`surface-3`, `border`, `text`, `accent`) drives both the
  dark (default) and `[data-theme="light"]` themes; components never
  hardcode colours.

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
| MCP transport | Hand-rolled JSON-RPC over `fetch` (`@modelcontextprotocol/sdk` is a listed dependency but unused by the browser client) |

---

# Project Status

CKS Studio is in **active development**, currently at **v0.6.6**. All
core exploration, review, and monitoring surfaces are implemented and
connected to live `cks-mcp` tools.

| Feature | Status |
|---------|--------|
| Graph exploration (`query_subgraph`) | ✅ Complete |
| Custom nodes (Definition, Claim, Concept, Fork, Resolution) | ✅ Complete |
| Cmd/Ctrl+K node search | ✅ Complete |
| Type filter (legend checkboxes) | ✅ Complete |
| Graph empty state & skeleton loading | ✅ Complete |
| 2D / 3D graph view toggle | ✅ Complete |
| Inference chain inspector | ✅ Complete |
| CRDT fork diff view | ✅ Complete |
| Pipeline monitor | ✅ Complete |
| Graph gallery | ✅ Complete |
| Agent observability (`list_agents`) | ✅ Complete |
| Agent control panel (start/stop/request-stop) | ✅ Complete |
| Dark / light theme | ✅ Complete |
| AI Chat panel | ✅ Complete |
| Standalone static demo (`demo.html`) | ✅ Complete |
| PWA / installable desktop app | ✅ Complete |
| Real MCP session presence (WebSocket/SSE, live updates) | 🔲 Planned |
| Real-time gossip visualiser | 🔲 Planned |
| Graph gallery clone-into-session | 🔲 Planned |

See [ROADMAP.md](ROADMAP.md) for what's next,
[docs/architecture.md](docs/architecture.md) for how the frontend is
structured, [docs/adr/](docs/adr/) for design decisions behind specific
features, and [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

# Testing

```bash
npm run test   # vitest
npm run ci     # biome + tsc --noEmit + vitest, same as CI
```

88+ tests, all passing.

---

# Contributing

Contributions are welcome! Please open an issue to discuss what you'd
like to work on. See the [CKS Core repository](https://github.com/Deus-corp/cks-core)
for the overall project conventions.

---

# License

MIT
