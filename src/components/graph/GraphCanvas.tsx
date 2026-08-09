import {
  Background,
  Controls,
  MiniMap,
  type Node,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useState } from 'react'
import '@xyflow/react/dist/style.css'
import { ExportControls } from '@/components/graph/ExportControls'
import { TypeLegend } from '@/components/graph/TypeLegend'
import { nodeTypes } from '@/components/graph/nodes'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import type { GraphState } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphLayout } from '@/features/graph-explorer/useGraphLayout'
import type { SubgraphResult } from '@/shared/types/graph'
import { cksToReactFlow, findPathBetweenNodes } from '@/shared/utils/graphUtils'

function looksLikeSubgraphResult(value: unknown): value is SubgraphResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.nodes) && Array.isArray(v.edges)
}

export function GraphCanvas({
  onNodeSelect,
}: { onNodeSelect?: (node: Node) => void }) {
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

  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [pathStartId, setPathStartId] = useState<string | null>(null)

  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(
    nodes,
    edges,
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

  const styledEdges = layoutedEdges.map((edge) => ({
    ...edge,
    style: highlightedEdgeIds.has(edge.id)
      ? { stroke: '#f59e0b', strokeWidth: 2.5 }
      : { stroke: '#6b7280', strokeWidth: 1 },
    animated: highlightedEdgeIds.has(edge.id),
  }))

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
        setDropError('Ожидается .json файл с подграфом (nodes/edges).')
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result))
          if (!looksLikeSubgraphResult(parsed)) {
            setDropError(
              'Файл не похож на экспорт query_subgraph ({nodes, edges}). ' +
                'Полный .cks.json ({objects: [...]}) нужно импортировать через ' +
                'scripts/import-ecosystem-graph.py — это требует создания сессии на сервере.',
            )
            return
          }
          const { nodes: newNodes, edges: newEdges } = cksToReactFlow(parsed)
          setNodes(newNodes)
          setEdges(newEdges)
        } catch {
          setDropError('Не удалось разобрать JSON.')
        }
      }
      reader.readAsText(file)
    },
    [setNodes, setEdges],
  )

  return (
    <div
      className="w-full h-full relative"
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
          pannable
          zoomable
          style={{ backgroundColor: 'var(--color-surface-2)' }}
        />
        <ExportControls />
      </ReactFlow>

      <TypeLegend />

      {pathStartId && (
        <div className="absolute top-3 left-3 z-10 bg-amber-900/90 border border-amber-700 text-amber-100 text-xs rounded px-3 py-1.5">
          Shift+click второй узел, чтобы подсветить путь до него
        </div>
      )}

      {relationDraft.active && (
        <div className="absolute top-3 left-3 z-10 bg-amber-900/90 border border-amber-700 text-amber-100 text-xs rounded px-3 py-1.5">
          Кликните{' '}
          {relationDraft.participantIds.length === 0 ? 'source' : 'target'}-узел{' '}
          ({relationDraft.participantIds.length}/2 выбрано)
        </div>
      )}

      {isDragOver && (
        <div className="absolute inset-0 z-10 bg-blue-500/10 border-2 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
          <span className="text-blue-300 text-sm bg-gray-900/90 px-3 py-1.5 rounded">
            Отпустите, чтобы загрузить подграф (.json)
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
            Закрыть
          </button>
        </div>
      )}
    </div>
  )
}
