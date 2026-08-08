import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '@/components/graph/nodes'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphLayout } from '@/features/graph-explorer/useGraphLayout'
import { type GraphState } from '@/features/graph-explorer/graphExplorerStore'

export function GraphCanvas({
  onNodeSelect,
}: { onNodeSelect?: (node: Node) => void }) {
  const nodes = useGraphStore((s: GraphState) => s.nodes)
  const edges = useGraphStore((s: GraphState) => s.edges)
  const highlightedEdgeIds = useGraphStore(
    (s: GraphState) => s.highlightedEdgeIds,
  )
  const selectNode = useGraphStore((s: GraphState) => s.selectNode)

  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(
    nodes,
    edges,
  )

  const styledEdges = layoutedEdges.map((edge) => ({
    ...edge,
    style: highlightedEdgeIds.has(edge.id)
      ? { stroke: '#f59e0b', strokeWidth: 2.5 }
      : { stroke: '#6b7280', strokeWidth: 1 },
    animated: highlightedEdgeIds.has(edge.id),
  }))

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id)
      onNodeSelect?.(node)
    },
    [selectNode, onNodeSelect],
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={layoutedNodes}
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
          style={{ backgroundColor: '#1f2937' }}
        />
      </ReactFlow>
    </div>
  )
}