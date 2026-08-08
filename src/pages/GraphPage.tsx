import { useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { SidePanel } from '@/components/layout/SidePanel'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { cksToReactFlow } from '@/shared/utils/graphUtils'
import { traceInferenceChain } from '@/shared/utils/graphUtils'
import { getMockGraph } from '@/services/mockData'
import { querySubgraph } from '@/services/mcpTools'

export function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const {
    setNodes,
    setEdges,
    addNodes,
    addEdges,
    selectedNodeId,
    edges,
    setHighlightedEdges,
    clearHighlight,
  } = useGraphStore()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const data = getMockGraph()
    const { nodes, edges } = cksToReactFlow(data)
    setNodes(nodes)
    setEdges(edges)
  }, [setNodes, setEdges])

  const handleExplore = async () => {
    if (!selectedNodeId || isLoading) return
    setIsLoading(true)
    try {
      const subgraph = await querySubgraph('mock-session', [selectedNodeId], 1)
      const { nodes: newNodes, edges: newEdges } = cksToReactFlow(subgraph)
      addNodes(newNodes)
      addEdges(newEdges)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTrace = () => {
    if (!selectedNodeId) return
    const chain = traceInferenceChain(selectedNodeId, edges)
    setHighlightedEdges(chain)
  }

  const handleClearHighlight = () => {
    clearHighlight()
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-semibold">CKS Studio</h1>
        <p className="text-sm text-gray-400">Interactive knowledge graph</p>
      </header>
      <div className="flex-1 flex">
        <main className="flex-1">
          <GraphCanvas onNodeSelect={setSelectedNode} />
        </main>
        <aside className="w-72 border-l border-gray-800 bg-gray-900 overflow-y-auto flex flex-col">
          <SidePanel node={selectedNode} />
          <div className="p-4 border-t border-gray-800 space-y-2 mt-auto">
            <button
              onClick={handleExplore}
              disabled={!selectedNodeId || isLoading}
              className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Loading...
                </>
              ) : (
                'Explore Neighbourhood'
              )}
            </button>
            <button
              onClick={handleTrace}
              disabled={!selectedNodeId}
              className="w-full rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trace Inference
            </button>
            <button
              onClick={handleClearHighlight}
              className="w-full rounded bg-gray-700 px-4 py-2 text-xs text-gray-300 hover:bg-gray-600"
            >
              Clear Highlight
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}