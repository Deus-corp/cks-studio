import {
  Background,
  ControlButton,
  Controls,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'
import { IconButton } from '@/components/common/IconButton'
import { ExportControls } from '@/components/graph/ExportControls'
import { FullscreenIcon } from '@/components/graph/FullscreenIcon'
import { GraphEmptyState } from '@/components/graph/GraphEmptyState'
import { GraphSearchPalette } from '@/components/graph/GraphSearchPalette'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import { nodeTypes } from '@/components/graph/nodes'
import type { GraphState } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphLayout } from '@/features/graph-explorer/useGraphLayout'
import { nodeTypeColor } from '@/shared/constants/nodeTypes'
import { useFullscreen } from '@/shared/hooks/useFullscreen'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import {
  cksToReactFlow,
  findPathBetweenNodes,
  looksLikeSubgraphResult,
} from '@/shared/utils/graphUtils'

export function GraphCanvas({
  onNodeSelect,
  isLoading,
  onRefresh,
}: {
  onNodeSelect?: (node: Node) => void
  /** True while the initial session graph fetch is in flight (shows a skeleton instead of an empty canvas). */
  isLoading?: boolean
  /** Reloads the current session's graph from the server. Switching
   *  sessions doesn't always leave the canvas in sync with the new
   *  session_id (see GraphPage's session-change effect), so this gives
   *  the user a manual way to force a refetch. Button is omitted if not
   *  provided. */
  onRefresh?: () => void
}) {
  const nodes = useGraphStore((s: GraphState) => s.nodes)
  const edges = useGraphStore((s: GraphState) => s.edges)
  const highlightedEdgeIds = useGraphStore(
    (s: GraphState) => s.highlightedEdgeIds,
  )
  const selectNode = useGraphStore((s: GraphState) => s.selectNode)
  const selectedNodeId = useGraphStore((s: GraphState) => s.selectedNodeId)
  const setNodes = useGraphStore((s: GraphState) => s.setNodes)
  const setEdges = useGraphStore((s: GraphState) => s.setEdges)
  const setHighlightedEdges = useGraphStore(
    (s: GraphState) => s.setHighlightedEdges,
  )
  const relationDraft = useGraphStore((s: GraphState) => s.relationDraft)
  const toggleRelationParticipant = useGraphStore(
    (s: GraphState) => s.toggleRelationParticipant,
  )
  const hiddenTypes = useGraphStore((s: GraphState) => s.hiddenTypes)
  const layoutDirection = useGraphStore((s: GraphState) => s.layoutDirection)
  const setLayoutDirection = useGraphStore(
    (s: GraphState) => s.setLayoutDirection,
  )
  const multiSelectedIds = useGraphStore((s: GraphState) => s.multiSelectedIds)
  const toggleMultiSelect = useGraphStore(
    (s: GraphState) => s.toggleMultiSelect,
  )
  const setMultiSelect = useGraphStore((s: GraphState) => s.setMultiSelect)
  const clearMultiSelect = useGraphStore((s: GraphState) => s.clearMultiSelect)

  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [pathStartId, setPathStartId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // 2D focus mode (mirrors the 3D toggle in GraphCanvas3D) -- opt-in via
  // the toolbar button; when on, clicking a node highlights it + its
  // direct neighbors and dims everything else until the user clicks the
  // same node again, clicks empty space, or turns the toggle off.
  const [isFocusModeEnabled, setIsFocusModeEnabled] = useState(
    () => useSettingsStore.getState().focusModeEnabledByDefault2D,
  )
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  // Measured (not guessed) vertical layout for the stack of top-right
  // Panels: ExportControls -> Focus toggle -> Controls (zoom/fullscreen).
  // Both react-flow's own <Controls> and ExportControls' <Panel> render
  // whatever buttons/errors they currently have, so a fixed pixel guess
  // for "where Focus goes" goes stale the moment either row's content
  // changes height (already happened twice per the comments below on
  // the Focus/Controls Panels). Measuring the Export row's actual
  // rendered height via panelRef and using a single GAP_PX on both
  // sides of Focus makes "Focus sits exactly centered between Export
  // and Controls" true by construction instead of by a periodically
  // re-tuned constant.
  const GAP_PX = 12
  // react-flow's own `.react-flow__panel` CSS rule (see its stylesheet)
  // sets `margin: 15px` on every Panel -- including <Controls>, which
  // renders through Panel internally. That margin applies *in addition
  // to* whatever `top` we set inline below, so a Panel's true rendered
  // top is always our `top` value + PANEL_MARGIN_PX, not just our value.
  // exportEl.offsetTop already reflects that (it's the real measured
  // position), so exportBottom below is already correct -- but when we
  // turn that into a `top` value for the *next* Panel (Focus), we have
  // to subtract this margin back out first, or the browser re-adds it
  // and the gap above Focus ends up PANEL_MARGIN_PX bigger than the gap
  // below it (Focus reads as sitting closer to Controls than to Export,
  // exactly as reported -- Controls' own top is derived from Focus's
  // *unrendered* JS value the same way Focus's is derived from
  // exportBottom, so that margin cancels out between Focus and Controls
  // but not between Export and Focus, where one side of the calculation
  // -- exportBottom -- is a real measured position and the other --
  // focusTop -- is still a pre-margin JS value at that point).
  const PANEL_MARGIN_PX = 15
  const exportPanelRef = useRef<HTMLDivElement>(null)
  const focusPanelRef = useRef<HTMLDivElement>(null)
  const [focusTop, setFocusTop] = useState(58)
  const [controlsTop, setControlsTop] = useState(100)

  useLayoutEffect(() => {
    const exportEl = exportPanelRef.current
    const focusEl = focusPanelRef.current
    if (!exportEl || !focusEl) return

    const recompute = () => {
      // offsetTop/offsetHeight, not getBoundingClientRect, since both
      // Panels share the same positioned ancestor (react-flow's pane) --
      // this stays correct regardless of the canvas's own scroll/zoom/
      // viewport position.
      const exportBottom = exportEl.offsetTop + exportEl.offsetHeight
      const nextFocusTop = exportBottom + GAP_PX - PANEL_MARGIN_PX
      setFocusTop(nextFocusTop)
      setControlsTop(nextFocusTop + focusEl.offsetHeight + GAP_PX)
    }
    recompute()

    // Re-measure if either row's height changes -- e.g. an export error
    // message appearing/disappearing under the Export row, or the Focus
    // button's own size changing (font/zoom/locale).
    const observer = new ResizeObserver(recompute)
    observer.observe(exportEl)
    observer.observe(focusEl)
    return () => observer.disconnect()
  }, [])

  // Fullscreen target is the outer wrapper div below (not the ReactFlow
  // pane itself), so overlays like TypeLegend and the drag/drop error
  // toast stay visible while fullscreen too.
  const containerRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef)

  // Type-filtered view of the graph — hidden types (toggled from
  // TypeLegend) are dropped before layout so dagre doesn't reserve space
  // for nodes that aren't shown, and their incident edges are dropped
  // with them so nothing dangles.
  const visibleNodes =
    hiddenTypes.size === 0
      ? nodes
      : nodes.filter(
          (node) =>
            !hiddenTypes.has((node.data?.cksType as string) || 'Concept'),
        )
  const visibleNodeIds =
    hiddenTypes.size === 0 ? null : new Set(visibleNodes.map((n) => n.id))
  const visibleEdges = visibleNodeIds
    ? edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      )
    : edges

  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(
    visibleNodes,
    visibleEdges,
    layoutDirection,
  )

  const displayNodes = relationDraft.active
    ? layoutedNodes.map((node) => {
        const idx = relationDraft.participantIds.indexOf(node.id)
        return idx === -1
          ? node
          : {
              ...node,
              data: { ...node.data, _relationSelectedIndex: idx },
            }
      })
    : layoutedNodes

  // Multi-select ring (Start Pipeline selection) -- layered on top of the
  // relation-draft mapping above rather than folded into it, since the
  // two selections are independent (a node can be mid relation-draft and
  // also part of the pipeline multi-select at the same time).
  const displayNodesWithSelection =
    multiSelectedIds.size === 0
      ? displayNodes
      : displayNodes.map((node) =>
          multiSelectedIds.has(node.id)
            ? { ...node, data: { ...node.data, _multiSelected: true } }
            : node,
        )

  // Focus neighborhood -- recomputed from the live edge list each render
  // rather than cached, since it's cheap (single pass) and needs to stay
  // in sync if the graph changes while a focus is active.
  const focusNeighborIds = focusedNodeId
    ? new Set(
        edges
          .filter(
            (edge) =>
              edge.source === focusedNodeId || edge.target === focusedNodeId,
          )
          .map((edge) =>
            edge.source === focusedNodeId ? edge.target : edge.source,
          ),
      )
    : null

  const displayNodesWithFocus = focusedNodeId
    ? displayNodesWithSelection.map((node) =>
        node.id === focusedNodeId || focusNeighborIds?.has(node.id)
          ? node
          : { ...node, data: { ...node.data, _focusDimmed: true } },
      )
    : displayNodesWithSelection

  // Persistent highlight for the selected/focused node -- keeps the same
  // brightened look CksNode applies on :hover even after the pointer
  // leaves, so clicking a node doesn't visually "lose" it the moment the
  // mouse moves away. Applied after focus-dimming so the selected node
  // itself is never simultaneously flagged as dimmed.
  const displayNodesWithSelectedHighlight = selectedNodeId
    ? displayNodesWithFocus.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: { ...node.data, _selected: true, _focusDimmed: false },
            }
          : node,
      )
    : displayNodesWithFocus

  const showMiniMap = useSettingsStore((s) => s.showMiniMap)
  const showEdgeLabels = useSettingsStore((s) => s.showEdgeLabels)

  const styledEdges = layoutedEdges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id)
    const isFocusRelated =
      !focusedNodeId ||
      edge.source === focusedNodeId ||
      edge.target === focusedNodeId
    // var(...) resolves fine inside an inline SVG style/attribute, and
    // picks up whichever theme's --color-trace-highlight/--color-graph-edge
    // is active (see styles/index.css) without this component needing to
    // know which theme is active. --color-graph-edge (not border-strong)
    // because edges need their own contrast target independent of the
    // border-token's neutral-panel styling — the light theme value is
    // deliberately darker than a plain border would be, so edges don't
    // wash out against the cream canvas.
    const stroke = isHighlighted
      ? 'var(--color-trace-highlight)'
      : 'var(--color-graph-edge)'
    return {
      ...edge,
      // Settings 2.0 "Show edge labels" toggle: drop the label rather
      // than hide it via CSS, so the layout doesn't reserve space for
      // hidden text.
      label: showEdgeLabels ? edge.label : undefined,
      // trace-highlight-edge drives a drop-shadow glow + pulse in
      // index.css -- on the light theme a plain color/width bump gets
      // lost in a dense tangle of crossing edges, so it needs its own
      // visual layer to stand out rather than just being "more green".
      className: isHighlighted ? 'trace-highlight-edge' : undefined,
      style: {
        stroke,
        strokeWidth: isHighlighted ? 3 : 1,
        opacity: isFocusRelated ? 1 : 0.15,
        transition: 'opacity 150ms ease',
      },
      markerEnd:
        typeof edge.markerEnd === 'object'
          ? { ...edge.markerEnd, color: stroke }
          : edge.markerEnd,
      animated: isHighlighted,
    }
  })

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (relationDraft.active && !event.shiftKey) {
        toggleRelationParticipant(node.id)
        return
      }
      if (event.shiftKey) {
        if (!pathStartId) {
          setPathStartId(node.id)
          return
        }
        const path = findPathBetweenNodes(pathStartId, node.id, edges)
        setHighlightedEdges(path)
        setPathStartId(null)
        return
      }
      // Ctrl/Cmd+click toggles this node in the multi-select set (used by
      // "Start Pipeline") without touching the single-node selection that
      // drives the side panel.
      if (event.ctrlKey || event.metaKey) {
        toggleMultiSelect(node.id)
        return
      }
      if (isFocusModeEnabled) {
        // Clicking the already-focused node exits focus (same toggle
        // behavior as the 3D focus mode); clicking a different node
        // moves focus to it.
        setFocusedNodeId((current) => (current === node.id ? null : node.id))
      }
      selectNode(node.id)
      setMultiSelect([node.id])
      onNodeSelect?.(node)
    },
    [
      selectNode,
      onNodeSelect,
      pathStartId,
      edges,
      setHighlightedEdges,
      relationDraft.active,
      toggleRelationParticipant,
      toggleMultiSelect,
      setMultiSelect,
      isFocusModeEnabled,
    ],
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
    setPathStartId(null)
    clearMultiSelect()
    setFocusedNodeId(null)
  }, [selectNode, clearMultiSelect])

  // Arrow-key spatial navigation between nodes. React Flow already makes
  // nodes Tab-focusable and triggers onNodeClick on Enter/Space (its
  // built-in keyboard a11y, active by default) -- what it doesn't do is
  // move focus *between* nodes other than via Tab order (DOM/insertion
  // order, which has no relationship to on-screen layout). This walks
  // `displayNodesWithSelectedHighlight`'s laid-out positions to find the
  // nearest node in the pressed arrow's direction from whichever node
  // currently has DOM focus, and moves focus (and, via
  // .react-flow__node's own Enter/Space handling, selection) there.
  const handleCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key

      // React Flow's own Enter/Space keydown handling (elementSelectionKeys
      // in @xyflow/system) only flips the node's *internal* selected flag
      // used for its arrow-key-drag feature -- it does not call the
      // onNodeClick prop, so none of GraphCanvas's own selection/focus-mode/
      // multi-select/relation-draft logic in handleNodeClick would ever run
      // from the keyboard without this. Ctrl/Cmd+Enter reaches the same
      // multi-select branch handleNodeClick already has for Ctrl/Cmd+click,
      // since the modifier flags are forwarded through unchanged below.
      if (key === 'Enter' || key === ' ') {
        const activeEl = document.activeElement as HTMLElement | null
        const nodeEl = activeEl?.closest<HTMLElement>('.react-flow__node')
        const nodeId = nodeEl?.getAttribute('data-id')
        const node = nodeId
          ? displayNodesWithSelectedHighlight.find((n) => n.id === nodeId)
          : undefined
        if (!node) return
        event.preventDefault()
        handleNodeClick(event as unknown as React.MouseEvent, node)
        return
      }

      if (
        key !== 'ArrowUp' &&
        key !== 'ArrowDown' &&
        key !== 'ArrowLeft' &&
        key !== 'ArrowRight'
      ) {
        return
      }

      const activeEl = document.activeElement as HTMLElement | null
      const activeNodeEl = activeEl?.closest<HTMLElement>('.react-flow__node')
      const currentId = activeNodeEl?.getAttribute('data-id')
      const current = currentId
        ? displayNodesWithSelectedHighlight.find((n) => n.id === currentId)
        : undefined

      // No node currently focused (e.g. focus just entered the canvas
      // via Tab landing on the pane): jump to the first node rather than
      // no-op, so arrow keys are useful the moment the canvas is
      // entered, not just after an initial Tab-to-a-node.
      if (!current) {
        const first = displayNodesWithSelectedHighlight[0]
        if (!first) return
        event.preventDefault()
        document
          .querySelector<HTMLElement>(
            `.react-flow__node[data-id="${first.id}"]`,
          )
          ?.focus()
        return
      }

      const cx = current.position.x
      const cy = current.position.y

      let best: Node | null = null
      let bestScore = Number.POSITIVE_INFINITY
      for (const candidate of displayNodesWithSelectedHighlight) {
        if (candidate.id === current.id) continue
        const dx = candidate.position.x - cx
        const dy = candidate.position.y - cy

        // Only consider candidates roughly in the pressed direction (the
        // "cone" is the primary axis's sign, with the perpendicular axis
        // used as a tiebreaker so navigation stays sane on off-grid,
        // dagre-laid-out graphs rather than only working on a strict
        // grid).
        let inDirection = false
        let primary = 0
        let perpendicular = 0
        if (key === 'ArrowRight') {
          inDirection = dx > 0
          primary = dx
          perpendicular = dy
        } else if (key === 'ArrowLeft') {
          inDirection = dx < 0
          primary = -dx
          perpendicular = dy
        } else if (key === 'ArrowDown') {
          inDirection = dy > 0
          primary = dy
          perpendicular = dx
        } else {
          inDirection = dy < 0
          primary = -dy
          perpendicular = dx
        }
        if (!inDirection) continue

        // Weight perpendicular drift heavier than distance along the
        // primary axis, so "the node roughly straight ahead" wins over
        // "the much closer node that's actually off to the side".
        const score = primary + Math.abs(perpendicular) * 2
        if (score < bestScore) {
          bestScore = score
          best = candidate
        }
      }

      if (best) {
        event.preventDefault()
        document
          .querySelector<HTMLElement>(`.react-flow__node[data-id="${best.id}"]`)
          ?.focus()
      }
    },
    [displayNodesWithSelectedHighlight, handleNodeClick],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragOver(false)
      setDropError(null)

      const file = event.dataTransfer.files?.[0]
      if (!file) return
      if (!file.name.endsWith('.json')) {
        setDropError('Expected a .json file with a subgraph (nodes/edges).')
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result))
          if (!looksLikeSubgraphResult(parsed)) {
            setDropError(
              "File doesn't look like a query_subgraph export ({nodes, edges}). " +
                'A full .cks.json ({objects: [...]}) needs to be imported via ' +
                'scripts/import-ecosystem-graph.py — that requires creating a session on the server.',
            )
            return
          }
          const { nodes: newNodes, edges: newEdges } = cksToReactFlow(parsed)
          setNodes(newNodes)
          setEdges(newEdges)
        } catch {
          setDropError('Could not parse JSON.')
        }
      }
      reader.readAsText(file)
    },
    [setNodes, setEdges],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      role="application"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleCanvasKeyDown}
    >
      <ReactFlow
        nodes={displayNodesWithSelectedHighlight}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
        {/* top-right, not the react-flow default bottom-left: bottom-left
         *  is where TypeLegend (see GraphPage) lives, and an expanded
         *  legend was covering the zoom/fullscreen controls entirely.
         *  top-right is otherwise unused (search/layout Panel above is
         *  top-left, MiniMap keeps its bottom-right default).
         *
         *  Order top-to-bottom is: ExportControls' own top-right Panel
         *  (refresh/PNG/SVG, default offset) -> this Focus toggle -> the
         *  zoom/fullscreen Controls block. focusTop/controlsTop (see the
         *  measurement effect above) are computed from ExportControls'
         *  actual rendered height plus GAP_PX on both sides of Focus, so
         *  Focus stays exactly centered between the two even if either
         *  row's contents change height later -- no more guessed pixel
         *  offsets to re-tune by hand. */}
        <Panel
          position="top-right"
          style={{ top: focusTop }}
          ref={focusPanelRef}
        >
          <IconButton
            onClick={() => {
              const next = !isFocusModeEnabled
              setIsFocusModeEnabled(next)
              // Turning the toggle off should release any active focus
              // immediately, same as the 3D toggle.
              if (!next) setFocusedNodeId(null)
            }}
            active={isFocusModeEnabled}
            label="Focus mode"
            title={
              isFocusModeEnabled
                ? 'Focus mode on — click a node to isolate its neighborhood'
                : 'Focus mode off — click a node to select it normally'
            }
            icon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 3v3M12 18v3M3 12h3M18 12h3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </Panel>
        {/* Zoom/fullscreen block, pushed down below the Focus toggle
         *  above -- see the measurement effect for controlsTop. */}
        <Controls position="top-right" style={{ top: controlsTop }}>
          <ControlButton
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <FullscreenIcon isFullscreen={isFullscreen} />
          </ControlButton>
        </Controls>
        {showMiniMap && (
          <MiniMap
            nodeStrokeWidth={3}
            nodeStrokeColor="var(--color-border-strong)"
            nodeColor={(node) => nodeTypeColor(node.data?.cksType as string)}
            // Explicit mask color/stroke: the xyflow default mask fill is a
            // light gray tuned for a dark canvas — on the light theme it's
            // nearly identical to the minimap background, so the "already
            // visible" viewport rectangle became indistinguishable from the
            // dimmed surrounding area. color-mix over --color-surface-0
            // (not -1/-2, so it tracks the *canvas* background specifically)
            // keeps the dimmed region readable in both themes, and the
            // stroke gives the viewport rect a visible outline either way.
            maskColor="color-mix(in srgb, var(--color-surface-0) 65%, transparent)"
            maskStrokeColor="var(--color-border-strong)"
            maskStrokeWidth={1}
            pannable
            zoomable
            style={{ backgroundColor: 'var(--color-surface-1)' }}
          />
        )}
        <ExportControls
          onRefresh={onRefresh}
          isRefreshing={isLoading}
          panelRef={exportPanelRef}
        />
        {nodes.length > 0 && (
          <Panel position="top-left">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-1.5 bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary shadow-lg transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="21"
                    y1="21"
                    x2="16.65"
                    y2="16.65"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Search nodes
                <kbd className="font-mono text-[10px] text-text-tertiary border border-border-subtle rounded px-1">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={() =>
                  setLayoutDirection(layoutDirection === 'TB' ? 'LR' : 'TB')
                }
                title={
                  layoutDirection === 'TB'
                    ? 'Switch to left-to-right layout (less horizontal stretch on bushy graphs)'
                    : 'Switch to top-to-bottom layout'
                }
                className="flex items-center gap-1.5 bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary shadow-lg transition-colors"
              >
                {layoutDirection === 'TB' ? '↓ Top-down' : '→ Left-right'}
              </button>
            </div>
          </Panel>
        )}
        <GraphSearchPalette
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onSelect={(id) => selectNode(id)}
        />
      </ReactFlow>

      {nodes.length === 0 && !isLoading && <GraphEmptyState />}
      {isLoading && nodes.length === 0 && <GraphSkeleton />}

      {pathStartId && (
        <div className="absolute top-3 left-3 z-10 bg-amber-900/90 border border-amber-700 text-amber-100 text-xs rounded px-3 py-1.5">
          Shift+click a second node to highlight the path to it
        </div>
      )}

      {relationDraft.active && (
        <div className="absolute top-3 left-3 z-10 bg-amber-900/90 border border-amber-700 text-amber-100 text-xs rounded px-3 py-1.5">
          Click the{' '}
          {relationDraft.participantIds.length === 0 ? 'source' : 'target'} node
          ({relationDraft.participantIds.length}/2 selected)
        </div>
      )}

      {isDragOver && (
        <div className="absolute inset-0 z-10 bg-blue-500/10 border-2 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
          <span className="text-blue-300 text-sm bg-surface-1/90 px-3 py-1.5 rounded">
            Drop to load subgraph (.json)
          </span>
        </div>
      )}

      {dropError && (
        <div className="absolute top-3 right-3 z-10 max-w-sm bg-red-900/90 border border-red-700 text-red-100 text-xs rounded px-3 py-2">
          {dropError}
          <button
            type="button"
            onClick={() => setDropError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
