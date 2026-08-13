import {
  Background,
  ControlButton,
  Controls,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'
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
  const [isFocusModeEnabled, setIsFocusModeEnabled] = useState(false)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

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
    >
      <ReactFlow
        nodes={displayNodesWithFocus}
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
         *  Pushed down via `top` (rather than left at the panel default)
         *  because ExportControls renders its own top-right Panel just
         *  above this one (refresh/PNG/SVG buttons) -- two top-right
         *  panels stack at the same offset otherwise, so the zoom/
         *  fullscreen controls end up hidden underneath the export
         *  buttons. 64px clears that button row (~28px tall) plus its
         *  own panel padding with room to spare. */}
        <Controls position="top-right" style={{ top: 64 }}>
          <ControlButton
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <FullscreenIcon isFullscreen={isFullscreen} />
          </ControlButton>
        </Controls>
        {/* Stacked below the fullscreen Controls (top: 64, ~36px tall) so
         *  it doesn't overlap ExportControls' own top-right Panel, which
         *  sits at the default (unstyled) top-right offset. */}
        <Panel position="top-right" style={{ top: 108 }}>
          <button
            type="button"
            onClick={() => {
              const next = !isFocusModeEnabled
              setIsFocusModeEnabled(next)
              // Turning the toggle off should release any active focus
              // immediately, same as the 3D toggle.
              if (!next) setFocusedNodeId(null)
            }}
            aria-pressed={isFocusModeEnabled}
            title={
              isFocusModeEnabled
                ? 'Focus mode on — click a node to isolate its neighborhood'
                : 'Focus mode off — click a node to select it normally'
            }
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium backdrop-blur-sm border shadow-lg transition-colors ${
              isFocusModeEnabled
                ? 'bg-cyan-950/90 border-cyan-800 text-cyan-100'
                : 'bg-surface-1/95 border-border-subtle text-text-secondary hover:text-text-primary hover:border-border'
            }`}
          >
            <svg
              width="13"
              height="13"
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
            Focus
          </button>
        </Panel>
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
        <ExportControls onRefresh={onRefresh} isRefreshing={isLoading} />
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
