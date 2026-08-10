import {
  Background,
  Controls,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useState } from 'react'
import '@xyflow/react/dist/style.css'
import { ExportControls } from '@/components/graph/ExportControls'
import { GraphEmptyState } from '@/components/graph/GraphEmptyState'
import { GraphSearchPalette } from '@/components/graph/GraphSearchPalette'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import { nodeTypes } from '@/components/graph/nodes'
import { TypeLegend } from '@/components/graph/TypeLegend'
import type { GraphState } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphLayout } from '@/features/graph-explorer/useGraphLayout'
import { nodeTypeColor } from '@/shared/constants/nodeTypes'
import type { SubgraphResult } from '@/shared/types/graph'
import { cksToReactFlow, findPathBetweenNodes } from '@/shared/utils/graphUtils'

function looksLikeSubgraphResult(value: unknown): value is SubgraphResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.nodes) && Array.isArray(v.edges)
}

export function GraphCanvas({
  onNodeSelect,
  isLoading,
}: {
  onNodeSelect?: (node: Node) => void
  /** True while the initial session graph fetch is in flight (shows a skeleton instead of an empty canvas). */
  isLoading?: boolean
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

  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [pathStartId, setPathStartId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

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

  const styledEdges = layoutedEdges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id)
    // var(...) resolves fine inside an inline SVG style/attribute, and
    // picks up whichever theme's --color-trace-highlight is active
    // (dark: amber-500, light: amber-700 — see styles/index.css) without
    // this component needing to know which theme is active.
    const stroke = isHighlighted
      ? 'var(--color-trace-highlight)'
      : 'var(--color-border-strong)'
    return {
      ...edge,
      style: { stroke, strokeWidth: isHighlighted ? 2.5 : 1 },
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
      selectNode(node.id)
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
    ],
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
    setPathStartId(null)
  }, [selectNode])

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
      className="w-full h-full relative"
      role="application"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => nodeTypeColor(node.data?.cksType as string)}
          pannable
          zoomable
          style={{ backgroundColor: 'var(--color-surface-2)' }}
        />
        <ExportControls />
        {nodes.length > 0 && (
          <Panel position="top-left">
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

      <TypeLegend />

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
