# Changelog

All notable changes to CKS Studio will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

---

## [0.12.0] - 2026-08-15

### Changed
- **Run History uses real `list_pipeline_runs`** – replaced the deterministic mock loader with a real MCP call. `RunHistoryPanel` now displays actual ADR-007 pipeline runs, including per-step status, timestamps, errors, and dead-letter task ids.
- **MCP wrapper `listPipelineRuns`** – added adapter in `mcpTools.ts` that maps the backend’s snake_case response to the UI’s camelCase `PipelineRun` shape.
- **Mock removed** – `mockRuns.ts` now delegates to `listPipelineRuns(sessionId)` and `IS_MOCK_DATA = false`; no demo banner is shown when real data is available.
- **Tests updated** – RunHistoryPanel tests now mock `listPipelineRuns` and assert that no mock badge is displayed.

### Known limitation
- The backend `list_pipeline_runs` only reconstructs runs started after `run_id` tracking was introduced; older runs without `run_id` won’t appear.

---

## [0.11.0] - 2026-08-15

### Added
- **Cross-graph Compare UI** – Gallery now has a Compare mode with per-card selection (capped at 2). Selecting two graphs and clicking “Compare selected” opens a modal showing shared object count, unique-to-each-side lists, and field-level differences.
- **Cross-graph Merge UI** – from the Compare modal, users can merge the two graphs into a new session, optionally register the result under a name, and resolve conflicts by keeping all from either side. The merged session can be opened directly.
- **Cross-graph Link form** – on GraphPage, with an object selected, a new “Cross-Graph Link” action opens a form to pick a target registered graph, target object, relation type, and optional name. Calls `link_graphs` and writes the link to both graphs.
- **MCP client wrappers** – `compareGraphs`, `mergeGraphs`, `linkGraphs` in `mcpTools.ts` with snake_case parameter mapping and structured error handling.
- **Types** – `CompareGraphsResult`, `MergeGraphsResult`, `LinkGraphsResult`, `CompareGraphsDifference`, `MergeGraphsConflict`.
- **Tests** – extensive coverage for wrappers, gallery compare mode, compare modal, merge conflict flow, and cross-graph link form.

### Changed
- `GraphGallery` now supports compare mode with selection checkboxes and a floating Compare selected bar.
- `GraphPage` SidePanel includes the Cross-Graph Link action.

---

## [0.10.0] - 2026-08-15

### Added
- **Pipeline Run History** – new `RunHistoryPanel` on the Pipeline page listing recent ADR-007 pipeline runs with status, step-level details (Researcher → Synthesizer → Reviewer → Arbiter), timestamps, errors, and dead-letter task references. Backed by a deterministic mock dataset until a `list_pipeline_runs` MCP tool exists; swapping the mock loader for a real MCP call is a one-line change.
- **Pipeline run utilities & types** – new status enums, sorting, filtering, truncation, and step-completion helpers.
- **Tests** – added coverage for run list rendering, expand/collapse, empty/error states, and utilities.

### Known limitation
- Run history currently uses mock data; backend integration is pending a future `list_pipeline_runs` tool.

---

## [0.9.0] - 2026-08-15

### Added
- **Publish to Gallery** – new `PublishToGalleryButton` modal on the Graph page side panel. Users can publish the current session as a registered graph with name, description, tags, and visibility (`private`, `team`, or `public`).
- **Mermaid graph preview** – gallery cards now have a lazy “Show preview” toggle that renders the graph as an inline SVG using Mermaid. The library is dynamically imported, so it doesn’t bloat the main bundle.
- **Team-scoped visibility** – gallery now supports `visibility` and `team` fields from the backend registry. A new team filter input narrows the gallery to a specific team namespace.
- **Graph type/source lineage display** – `GraphRegistryEntry` includes `source_graph_name` for clone lineage (already partially delivered earlier; now fully integrated with cards/badges).

### Changed
- `mcpTools` client wrappers updated for `visibility`, `team`, and `visualize_graph`.
- `galleryStore` now manages team filter and updated load/search logic.
- `GraphGallery` UI now displays visibility/team information and previews.
- Main bundle size reduced by code-splitting Mermaid into a separate async chunk.

### Known issue
- Tests for the new Publish button, Mermaid preview, and team filters are not yet included; they will follow in a separate patch.

---

## [0.8.1] - 2026-08-15

### Added
- **Forked from lineage in Gallery** – cloned graphs now show a “Forked from <source>” badge and can jump back to the original graph. The badge is clickable and triggers a gallery search for the source name.
- **`source_graph_name` in GraphRegistryEntry** – studio type now includes clone lineage info from the backend.
- **Tests** for lineage badge rendering and source-jump behavior.

### Changed
- `GraphGallery` now uses `source_graph_name` from registered graphs.

---

## [0.8.0] - 2026-08-15

### Added
- **Persistent gallery storage** – the local dev MCP launcher now uses `~/.cks-mcp/cks_mcp.db` instead of `/tmp/cks-studio-dev.db`, so registered graphs survive reboots and remain in the gallery until explicitly deleted.
- **Clone graph from Gallery** – each public graph card now has a Clone button that calls the new `clone_graph` MCP tool, sets the returned session as current, and navigates to the Graph page. Inline success/error messages are shown.
- **Gallery tag filters** – clickable tag chips built from the union of tags across visible graphs, allowing quick filtering by tag.
- **Gallery sorting** – sort dropdown with Most recently updated, Name A-Z, and Name Z-A (client-side).
- **CloneGraph wrapper** – added `cloneGraph()` to `mcpTools` with snake_case argument mapping and structured error handling.

### Changed
- `GraphGallery` and `galleryStore` now manage sort order and tag filter.
- Added utility functions `collectTags` and `sortGraphs`.
- Added tests for clone flow, gallery filters, sorting, and utility functions.

---

## [0.7.0] - 2026-08-14

### Added
- **Settings 2.0** – expanded Settings page with tabbed sections: Appearance, Connection, AI & LLM, Graph Behavior, About, and Danger Zone.
- **`settingsStore`** – new Zustand store persisting all client-side settings to localStorage, with defaults and `resetAllSettings()`.
- **Graph defaults** – default view mode (2D/3D), default layout direction (TB/LR), minimap/legend/edge label toggles.
- **Connection settings** – MCP server URL, recent sessions list, live SSE toggle, refresh debounce and polling interval controls.
- **AI preferences** – preferred provider/model inputs, Quick AI default open toggle, and server setup snippets for Ollama/Anthropic/OpenAI-compatible/HTTP server.
- **Graph behavior settings** – focus mode defaults for 2D/3D, degree-based sizing toggle, polling interval.
- **Danger Zone** – reset all settings with confirmation, returning theme and preferences to defaults.
- **Tests** – added store persistence, settings page, integration, and reset tests.

### Changed
- `GraphCanvas` and `GraphCanvas3D` now initialize focus mode from settings defaults.
- `GraphPage` now respects `showTypeLegend`, SSE debounce/auto-reconnect settings.
- `AgentPanel`/`DeadLetterPanel` polling interval now driven by settings.
- `QuickAiPanel` default open state driven by settings.

---

## [0.6.32] - 2026-08-14

### Fixed
- **Bottom overlay alignment** – TypeLegend and bottom dock panels now use a shared `15px` offset, aligning them with React Flow’s built-in MiniMap/Controls margin. In 3D mode, the dock is raised slightly (`21px`) to avoid 3d-force-graph’s nav hint.
- **WhyThisBeliefPanel label** – collapsed tab now says “Select a node” when no node is selected (already partially delivered; now consistent).

---

## [0.6.31] - 2026-08-14

### Fixed
- **Graph page panel positioning** – “Why this belief?” collapsed tab now shows “Select a node” when no node is selected. The tab is raised above 3d-force-graph’s built-in navigation hint in 3D mode. Quick AI launcher is positioned to avoid overlapping the React Flow MiniMap in 2D and the bottom-right corner in 3D.
- **Panel overlap prevention** – bottom dock panels now account for view mode and existing bottom-right UI elements.

---

## [0.6.30] - 2026-08-14

### Added
- **Why this belief? panel** – collapsible bottom panel on Graph page for inspecting the active inference chain of the selected node. Uses `explain_knowledge(object_id=...)` and shows operator, confidence, justification, premises chips, and superseded steps.
- **Quick AI panel** – collapsible mini-chat on Graph page that reuses the same conversation store as the full Chat page. Supports quick questions, tool-call responses, error display, and an “Open full Chat” button that navigates to `/chat` with the shared conversation intact.
- **`useExplainInference` hook** – fetches inference explanation with request-sequence guard and proper loading/error states.
- **Tests** for both panels and the new hook/type integration.

### Changed
- Graph page bottom dock now hosts independent collapsible panels (`WhyThisBeliefPanel` centered, `QuickAiPanel` bottom-right) that don’t block the canvas elsewhere.

---

## [0.6.29] - 2026-08-14

### Added
- **Demo Pipeline page** – static Kanban-style pipeline monitor derived deterministically from the bundled ecosystem graph. Shows four stage columns (`Awaiting Research`, `Awaiting Review`, `Needs Research`, `Resolved`) with mock cards and transition logs. No backend required.
- **Demo Diff page** – static version diff example showing one added, one removed, and one modified object with color-coded rows and count badges. Includes a mock modified `cks-core` version change (`v1.21.1` → `v1.22.0`) and a fictional `cks-analytics` addition.
- **`listDemoGraphObjects`** – exported helper from `mockClient` that returns non-relation objects from the bundled graph for demo pages.
- **Tests** for both new demo pages.

### Changed
- The static demo banner and README/demo comments now reflect that all tabs have mock content instead of placeholders.

---

## [0.6.28] - 2026-08-14

### Added
- **Metrics strip** – new reusable `MetricsStrip` component placed on Agents and Pipeline pages. Shows key operational metrics: registered graphs, running in-process agents, alive standalone processes, and dead-letter task count. Updates every 10 seconds, pauses when the tab is hidden, and handles per-metric errors gracefully.
- **`useMetricsStripPolling` hook** – polls `list_graphs`, `list_agents`, `list_processes`, `list_dead_lettered_conflicts` independently using `Promise.allSettled`, so a failure in one source does not blank the rest.

### Changed
- Agents and Pipeline pages now render `MetricsStrip` above their existing content.
- Added unit tests for metrics strip rendering, error placeholders, unsupported backend handling, polling, and visibility pause.

---

## [0.6.27] - 2026-08-14

### Added
- **Graph stats in Node Types panel** – the bottom-left legend now has a Stats/Types toggle. Stats view shows graph name/session id, node count, edge count, visible type count, selected count (if any), and most connected node.
- **Consistent toolbar shadows** – refresh, PNG export, and SVG export buttons now have the same shadow treatment as the zoom/fullscreen controls.

### Changed
- **2D zoom controls theme** – React Flow zoom/fullscreen controls now match the background, border, and blur of the other toolbar buttons.
- Added tests for TypeLegend stats toggle.

---

## [0.6.26] - 2026-08-14

### Added
- **Real-time session event subscription** – GraphPage now subscribes to the cks-mcp `/events` SSE endpoint and automatically refreshes the graph when `VersionCreated`, `TransactionCommitted`, `GossipConflictDetected`, `CRDTForkDetected`, or `AgentStepCompleted` events arrive. Updates are debounced/coalesced, so bursts of events trigger one refresh.
- **`sessionEvents` / `useSessionEvents`** – framework-agnostic SSE wrapper and React hook for the real-time connection. No-op in demo mode, with automatic reconnect and backoff.
- **Tests** – unit tests for SSE connection logic, filtering, debouncing, session change, and unmount behavior.

### Changed
- ROADMAP updated: Real MCP Session Presence marked in progress.

---

## [0.6.25] - 2026-08-14

### Fixed
- **2D focus button centering** – Focus toggle now correctly accounts for react-flow’s built-in 15px panel margin when computing its `top`, so the gap above and below Focus is truly equal. Previously the rendered gap above was larger than the gap below, making Focus appear biased toward the zoom controls.
- **Focus centering regression tests** – added a concrete arithmetic test that verifies the true rendered gaps above and below Focus are identical.

---

## [0.6.24] - 2026-08-14

### Fixed
- **Demo graph persistence** – GraphPage in the static demo now remains mounted when switching demo tabs, matching the real studio behavior. The 3D graph no longer re-unfurls, resets the camera, or loses selected node state when navigating away and back.
- **2D focus button centering** – the Focus toggle is now dynamically positioned exactly between the Export SVG row and the zoom/fullscreen controls using measured heights and a shared gap, instead of a hand-tuned pixel offset that could go stale.

### Added
- Regression tests for the 2D focus centering formula.

---

## [0.6.23] - 2026-08-14

### Fixed
- **Graph state persistence across navigation** – GraphPage is now kept mounted when navigating to other tabs, so 3D camera, force-simulation positions, focus mode, and selected node no longer reset when returning to the Graph tab.
- **Removed repeated 3D reinitialization** – avoiding unmount/remount of GraphCanvas3D eliminates costly WebGL context rebuilds and simulation restarts on every tab switch.

### Added
- Regression test `App.persistentGraphPage.test.tsx` asserting GraphPage is hidden rather than unmounted when on another route.

---

## [0.6.22] - 2026-08-14

### Changed
- **3D card theme refresh batching** – card texture updates now process in small batches per animation frame instead of one synchronous pass, preventing main-thread stalls on large graphs during theme toggles.
- **3D card texture filtering** – card textures no longer generate mipmaps, reducing GPU overhead and improving theme-switch responsiveness.
- **Light-theme 3D cards** – cards now use a warm amber fill with white text and a darker amber border, greatly improving contrast against the light canvas.

### Added
- Regression tests covering light-theme card colors, disabled mipmaps, and batched refresh logic.

---

## [0.6.21] - 2026-08-13

### Fixed
- **3D theme refresh effect** – the debounced theme-repaint effect now correctly depends on `theme`. It previously ran only once on mount, so later light/dark toggles did not repaint 3D cards and links. Added a regression test asserting the dependency array is `[theme]`.

---

## [0.6.20] - 2026-08-13

### Fixed
- **3D theme refresh dependency** – the theme-refresh effect now correctly depends on `theme`, so 3D cards and links repaint immediately when the theme toggles. Previously the effect only ran on mount, so theme changes had no effect on the 3D graph.
- **3D link/border theme colors** – 3D links and card borders now use theme-aware colors, matching the light/dark palette and improving visibility.
- **Debounced theme repaint** – rapid theme toggles no longer stack full-graph texture redraws; the repaint is debounced.

### Added
- **Regression tests** for theme-aware link colors and the dependency fix.

---

## [0.6.19] - 2026-08-13

### Fixed
- **2D toolbar overlap** – repositioned the Focus toggle, zoom/fullscreen controls, and Export SVG buttons so they no longer overlap. The top-right controls now have explicit, non-colliding offsets.
- **3D light-theme cards** – card background now uses the 2D surface-3 token (`#e5e7ec`) instead of pure white, improving contrast and readability against the light canvas.
- **GPU resource leak** – added `disposeNodeObject3D` and call it before `nodeThreeObject` rebuilds in focus mode, exit focus, and relation-draft updates. This prevents leaking textures and materials on every rebuild, which was the real cause of progressive lag in long 3D sessions.

### Added
- **Regression tests** for GPU disposal (`disposeNodeObject3D`) and theme colors.

---

## [0.6.18] - 2026-08-13

### Fixed
- **3D theme switching performance** – theme toggling now refreshes existing card textures in place instead of rebuilding all node sprites and materials, preventing GPU memory leaks and progressive lag after repeated light/dark switches.
- **3D card light theme** – cards now use a near-opaque light-theme background and readable text, matching 2D node styling.
- **2D focus dimming** – nodes outside the focused cluster are now strongly dimmed, while the focused node and its direct neighbors stay fully visible.
- **2D selected node persistence** – selected/focused node keeps the brightened hover appearance after the pointer leaves.

### Added
- **3D card theme tests** – regression test confirming theme colors differ and light theme uses an opaque background.
- **2D focus mode tests** – coverage for dimming behavior and selected-node persistence.

### Changed
- Exported `drawNodeCardCanvas` and `CARD_THEME_COLORS` from `GraphCanvas3D` for testability.

---

## [0.6.17] - 2026-08-13

### Added
- **Auto theme option** – real Settings now offers Light, Dark, and Auto. Auto resolves the current system theme and is visually selected.
- **Stop pipeline button** – Start Pipeline toolbar now includes a Stop Pipeline control that calls `request_process_stop` for the pipeline process.
- **3D focus mode toggle** – 3D focus mode is no longer auto-triggered on node click. A top-right toggle enables focus mode; when off, clicking a node keeps the old select/zoom behavior.
- **2D focus mode** – added a focus mode toggle to the 2D graph. When enabled, clicking a node highlights it and its neighbors while dimming the rest.
- **Additional tests** – added coverage for StartPipelineButton (stop and truncation), ThemeToggle auto behavior, and 2D focus mode.

### Fixed
- **Start Pipeline message overflow** – long run IDs now wrap/truncate inside the message container instead of overflowing.
- **3D performance** – multi-select/focus updates now manipulate existing three.js objects directly instead of rebuilding all node sprites, reducing lag on larger graphs.
- **3D card theme** – cards now adapt to light/dark theme using the same token palette as 2D nodes.

---

## [0.6.16] - 2026-08-13

### Added
- **Start Pipeline button** – select one or more nodes in the 2D/3D graph (Ctrl/Cmd+click for multi-select) and start a pipeline run directly from the graph toolbar. Calls the new `start_pipeline` MCP tool with the current session and selected object IDs.
- **Dead Letter inbox** – new Dead Letter page for reviewing and resolving dead-lettered conflict tasks. Lists tasks via `list_dead_lettered_conflicts`, shows proposed resolutions via `review_dead_letter`, and supports approve/reject actions (`approve_resolution` / `reject_resolution`) with automatic list refresh.
- **Multi-select rings** – selected nodes in both 2D and 3D get a distinct ring indicator, making multi-selection visually clear.

### Changed
- **2D graph controls** – zoom/fullscreen controls positioned so they no longer overlap the Export SVG button.
- **Navigation** – added Dead Letter page to the main nav with its own per-route tint color.

---

## [0.6.15] - 2026-08-13

### Fixed
- **3D focus camera** – entering focus mode no longer zooms the camera out. The cluster is pinned and non-focus nodes are pushed aside, but the camera stays exactly where the user left it. A new “Frame cluster” button in the focus banner lets users frame the focused neighborhood manually.
- **2D controls overlap** – zoom and fullscreen controls moved from bottom-left to top-right in the 2D graph, so they no longer overlap the collapsible Node types legend.

### Added
- **3D fullscreen button** – the 3D graph now has a fullscreen toggle, using the same fullscreen icon and hook as the 2D graph.
- **Shared fullscreen hook** – `useFullscreen` centralizes Fullscreen API handling and `FullscreenIcon` provides a consistent icon for both graph views.

---

## [0.6.14] - 2026-08-13

### Changed
- **3D graph spacing** – default link distance and charge strength adjusted so nodes are roughly twice as far apart, making the 3D graph noticeably less compressed.
- **3D click-to-focus mode** – clicking a node now pins it and its direct neighbors into a stable figure while non-focus nodes are repelled aside and dimmed. The focused cluster is framed automatically; clicking the same node again or the background exits focus mode.
- **Collapsible node type legend** – the legend in the bottom-left can now be collapsed to a compact "Node types" button and expanded again on click.

### Added
- **3D focus ring indicator** – the focused node and its neighbors get a cyan ring (brighter for the primary node, dimmer for neighbors) for clear visual identification.
- **3D axis labels** – X/Y/Z labels added at the axis tips for easier spatial orientation.

---

## [0.6.13] - 2026-08-13

### Added
- **Nightly ecosystem graph auto-update** – new GitHub Actions workflow (`update-ecosystem-graph.yml`) and `scripts/update_versions.py` that run nightly, fetch the latest component versions from PyPI/GitHub, and update `scripts/cks-ecosystem.json` with a minimal diff. Validates the graph with `cks validate` before committing.
- **Automatic demo publishing** – new `publish-demo.yml` workflow builds the static demo from cks-studio and pushes it to `cks-website`'s `public/demo` whenever a `v*` tag is pushed. Other files in `public/` (favicon, og-card, etc.) are preserved.

---

## [0.6.12] - 2026-08-12

### Added
- **Expanded static demo** – Gallery, Agents, Chat, and Settings now have dedicated mock pages in the static demo. Gallery shows illustrative graphs with the bundled cks-ecosystem openable; Agents displays seven in-process sweepers and four standalone processes; Chat presents a sample ai_chat conversation; Settings offers a working theme selector, component versions read from the bundled graph, and a copyable Ollama setup snippet.
- **Demo theme switching** – the demo now respects the active theme store and provides an icon-based light/dark toggle in the nav, in addition to the theme selector on Settings.
- **Demo toast system** – non-functional demo interactions (e.g. opening a gallery card without data) now show a lightweight toast instead of failing silently.

### Changed
- **SettingsPage ThemeToggle exported** – reused by the demo nav and settings pages.
- **mockClient** now exports `listComponentVersions()` and `DEMO_GRAPH_OBJECT_COUNT` from the bundled ecosystem graph for demo pages.

---

## [0.6.11] - 2026-08-12

### Added
- **Per-route nav tints** – top navigation destinations now have distinct hues (Graph, Pipeline, Gallery, Diff, Agents, Chat, Settings) instead of one shared accent, with theme-aware active/hover background washes and underlines.
- **Full studio menu in static demo** – the demo now shows all seven navigation entries. Non-graph sections render a clear “available in full version” placeholder, so the demo communicates the full studio surface without requiring a live server.

### Fixed
- **Chat send button alignment** – the input form now uses vertical centering, keeping the Send button level with the initial textarea height instead of riding low against the bottom.

---

## [0.6.10] - 2026-08-12

### Changed
- **2D node sizing by importance** – `CksNode` and `useGraphLayout` now scale node cards, fonts, and layout dimensions with connection degree (incident edge count), using sqrt-tapered growth to keep the dagre layout stable. Hub nodes (e.g. `cks-core`) render larger than leaf nodes, and each connected node shows a small degree badge.

---

## [0.6.9] - 2026-08-12

### Changed
- **3D card sizing by node importance** – card dimensions in 3D mode now scale with node degree (number of incident edges). Hub nodes (e.g. `cks-core`) render larger than leaf nodes (e.g. `diagnostics`), making structure importance visible at a glance.
- **Degree badge on 3D cards** – each connected card shows a small pill with its connection count in the bottom-right corner (hidden for isolated nodes).

---

## [0.6.8] - 2026-08-12

### Added
- **3D card rendering** – nodes in the 3D graph now render as flat, billboard-style cards matching the 2D node design (type-colored accent strip, icon, name). Hovered cards brighten and show a colored outline; non-neighbor cards dim. Relation-draft participants get numbered badges.

### Changed
- Kept the original sphere rendering behind a `USE_CARD_NODES` toggle for easy fallback.

---

## [0.6.7] - 2026-08-12

### Changed
- **Design sync with cks-website** – dark‑theme palette (surface, border, text) now matches the docs site’s graphite tones.
- **Logo recoloured** from violet to the brand amber (`#e8a33d`) used on the website.
- **Buttons toned down** – primary actions use muted brand amber instead of bright emerald/blue; secondary actions use `surface-3`.
- **Light‑theme brand tokens** added for consistency with the dark theme.

---

## [0.6.6] - 2026-08-11

### Added
- **Demo back-link** – floating "Back to Docs" button returns visitors from the embedded demo to the documentation site.
- **Demo placeholder pages** – Gallery and Pipeline tabs now show a static placeholder instead of an empty page.

### Fixed
- **Empty graph in demo** – `mockClient.querySubgraph` without `seed_ids` now returns the full bundled graph as fallback.

---

## [0.6.5] - 2026-08-11

### Added
- **Static demo** – a standalone `demo.html` that renders the full CKS ecosystem graph entirely in the browser, with no server required. Includes a mock MCP client, restricted navigation (Graph / Gallery / Pipeline), and a demo banner. Built alongside the main studio as a second Vite entry point.
- **`mockClient.ts`** – in‑memory MCP client serving the bundled ecosystem graph for the static demo.

---

## [0.6.4] - 2026-08-11

### Fixed
- **Missing node type icons** – added colours and icons for `Constraints`, `Event`, `Feature`, `Function`, `LLMProvider`, `Operator`. Unknown types now render a fallback icon (📄) instead of "?".
- **3D sidebar visibility** – the side panel no longer disappears behind the WebGL canvas in 3D mode.

---

## [0.6.3] - 2026-08-11

### Fixed
- **Chat input** – replaced single‑line `<input>` with auto‑resizing `<textarea>`, added Enter‑to‑send / Shift+Enter‑for‑newline.
- **3D mode side panel** – added `z‑10` to the sidebar so it stays above the WebGL canvas.
- **Missing node type icons** – added colours and icons for `ReasoningNode`, `Entity`, `Axiom`, `Lemma`, `Theorem`, `Proof`, `InferenceStep`, `VerificationRecord`.
- **Agent panel standalone‑process cards** – improved layout, aligned Request Stop buttons, added a note that these processes are started manually.

---

## [0.6.2] - 2026-08-11

### Added
- **3D graph parity** – path highlighting (Shift+click), drag‑and‑drop subgraph import, relation‑draft participant picking, and Cmd/Ctrl+K search now work in 3D mode, matching the 2D GraphCanvas.
- **3D clustering** – nodes are softly grouped by their containing Component/Module, making the ecosystem graph visually separable by repository.
- **3D orientation grid and axes** – a subtle ground plane and RGB axes help orient the view without interfering with the data.
- **2D layout direction toggle** – switch between top‑to‑bottom (TB) and left‑to‑right (LR) dagre layout in 2D mode to handle wide graphs.

### Changed
- **`looksLikeSubgraphResult`** extracted to `graphUtils.ts` and reused by both 2D and 3D canvases.
- **`useGraphLayout`** now accepts a `rankdir` parameter for the layout direction toggle.

---

## [0.6.1] - 2026-08-11

### Added
- **3D graph improvements** – nodes now show always-visible text labels, size scales with degree (hub nodes appear larger), hover highlights the node and its neighbours while dimming the rest.
- **Lazy‑loaded 3D module** – `GraphCanvas3D` is now code‑split (React.lazy + Suspense), so the 2D-only default view never pays the cost of the Three.js bundle.
- **Ecosystem type icons** – added distinct colours and emoji icons for `Component`, `Module`, `ADR`, `Tool`, `Agent`, `Interface`, `StorageBackend`, `Plugin`, `Sweeper`, `Task`, and `Relation` so the ecosystem graph is no longer monochrome.

---

## [0.6.0] - 2026-08-11

### Added
- **3D force‑directed graph** – toggle between 2D (dagre) and 3D (force‑graph) views using the new 2D/3D switch in the Graph page header. 3D mode spreads nodes over a volume, making wide graphs with many same‑rank nodes (e.g. many Tools implementing one ADR) much more compact.
- **GraphCanvas3D component** – uses `3d-force-graph` (Three.js) with node colouring by CKS type, click‑to‑focus camera, and hover labels.
- **viewMode** in `graphExplorerStore` – persists 2D/3D preference across page switches.

---

## [0.5.9] - 2026-08-11

### Fixed
- **SidePanel readability on light theme** – property values now use `text-text-primary` instead of light gray.
- **Search palette centering** – replaced manual `setCenter` with `fitView` for reliable node centering after palette close.
- **Trace Inference visibility** – added drop‑shadow glow and opacity pulse animation so highlighted edges stand out even when crossing other edges.

---

## [0.5.8] - 2026-08-11

### Fixed
- **Search palette centering** – double `requestAnimationFrame` ensures the target node is measured before centering, preventing off‑screen jumps.
- **Trace inference highlight** – replaced hardcoded `#f59e0b` with a CSS custom property `--trace-highlight`, now green on light theme for better contrast.
- **Light‑theme dark artifacts** – GraphPage header, sidebar, and Gallery search/cards now use theme tokens instead of hardcoded `gray‑*` classes.
- **Light‑theme text contrast** – `--color-text-secondary` and `--color-text-tertiary` darkened for readability.
- **Graph edges and nodes on light theme** – edge stroke and node background are now theme‑aware, improving contrast against the cream background.
- **MiniMap on light theme** – mask color and node colors now adapt to the active theme.
- **Refresh button** – added a ↻ button next to Export controls, reloading the current session graph.
- **Explore Neighbourhood** – fixed logic so it correctly detects newly added nodes instead of silently doing nothing.

---

## [0.5.7] - 2026-08-11

### Fixed
- **Search palette centering** – use a double `requestAnimationFrame` so React Flow finishes measuring the target node after the palette closes, preventing the viewport from jumping off‑screen.
- **Trace inference highlight** – replaced hardcoded `#f59e0b` with a CSS custom property `--trace-highlight`, which now adapts to the current theme (a darker, more saturated tone on light theme).
- **Light‑theme dark artifacts** – replaced the remaining hardcoded `gray‑*` classes in GraphPage, GraphGallery, SidePanel, CreateNodeForm, CreateRelationForm, ForkDiffPanel, ConnectionStatus, and HealthIndicator with design‑token equivalents (`bg-surface‑*`, `text‑text‑*`, `border‑border‑*`).
- **Chat input visual prominence** – the message form now has a distinct background, increased padding, and a leading icon so it no longer blends into the page.

---

## [0.5.6] - 2026-08-10

### Fixed
- **Search palette centering** – deferred `setCenter` to next frame so React Flow can measure the target node, fixing off‑screen jumps to freshly‑added or off‑screen nodes.
- **Node overlap on large graphs** – layout now computes per‑node widths based on label length, preventing long ADR titles from overlapping adjacent nodes.
- **Explore Neighbourhood fallback** – automatically retries at depth=2 when depth=1 returns empty, instead of showing “No neighbours found” for indirectly connected nodes.
- **PNG export quality** – canvas is now sized proportionally to the graph’s bounding box (with a 1600×1200 floor) and uses 3× pixel ratio, keeping text legible on large graphs.
- **Session error recovery** – unreachable sessions are pruned from “Recent sessions” on connection failure, so dead IDs don’t accumulate in the dropdown.
- **Light‑theme cream background** – changed `surface-0` from near‑white to a warm cream tone, improving contrast with white panel surfaces.
- **Agent / Chat / Pipeline / VersionDiff panels** – replaced remaining hardcoded `gray‑*` classes with theme‑aware design tokens.

---

## [0.5.5] - 2026-08-10

### Added
- **Model selector in AI Chat** – dropdown next to the Chat title shows available models for the current LLM provider (Ollama via live `/api/tags`, Anthropic and OpenAI‑compatible via hardcoded lists). Selected model is passed as optional `model` argument to `ai_chat`.
- **`listLLMModels`** function in `mcpTools.ts` and **`useLLMModels` hook** – typed wrappers around the new `list_llm_models` MCP tool.
- **`selectedModel`** in `chatStore` – persists the user’s model choice across page switches.
- Unit tests for model selector and `useLLMModels` hook.

---

## [0.5.4] - 2026-08-10

### Added
- **AI Chat onboarding** – differentiated error banners for missing session, unavailable LLM provider, network errors, and tool failures. Clear instructions with links to Settings and Graph page.
- **`ChatError` discriminated type** – `no_session` | `llm_provider_unavailable` | `llm_call_failed` | `network` | `other`.
- **Unit tests** for all ChatPanel error states.

---

## [0.5.3] - 2026-08-10

### Added
- **PWA support** – the studio can now be installed as a standalone desktop app from Chrome/Edge/Safari. Includes a web manifest, static asset caching via `vite-plugin-pwa`, and theme-color meta tag.

---

## [0.5.2] - 2026-08-10

### Added
- **LLM Provider status in Settings** – shows the current LLM provider (Ollama / Anthropic / Not configured), its model, and availability. Includes a Refresh button and setup instructions.
- **ChatPanel LLM status banner** – warns before sending a message if no LLM provider is configured, with a link to Settings.
- **`getLLMStatus`** function in `mcpTools.ts` and **`useLLMStatus` hook** – typed wrappers around the new `get_llm_status` MCP tool.
- **Unit tests** for SettingsPage LLM status display.

---

## [0.5.1] - 2026-08-09

### Added
- **Graph skeleton** – shows a pulsing placeholder while a session's graph is loading, instead of an empty canvas.
- **Graph empty state** – invites the user to connect a session or drag in a subgraph export when no graph is loaded.
- **Cmd/Ctrl+K search palette** – fuzzy search over all nodes by label or id with keyboard navigation (arrows + Enter), centres the viewport on the selected node.
- **Type filter in the legend** – clicking a type toggles its visibility on the canvas; a "Show all" button resets the filter. The legend now shows only types actually present in the graph.
- **Light theme** – new `[data-theme="light"]` overrides in `index.css`, a theme store (`themeStore.ts`), and a light/dark toggle on the Settings page. Respects `prefers-color-scheme: light` on first visit.
- **MiniMap node colours** – now reflects the actual CKS type colour.

### Changed
- **English i18n** – remaining Russian strings in `AgentPanel`, `VersionDiff`, and `GraphCanvas` replaced with English.
- **GraphCanvas** accepts an `isLoading` prop; the skeleton renders only while loading and no nodes are on screen.
- **Type legend** is now interactive (checkboxes) instead of static text.
- **Settings page** shows the theme toggle as the first working preference.
- **`hiddenTypes`** added to `graphExplorerStore` to support the type filter.

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