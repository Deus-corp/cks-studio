import type { Node } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { SidePanel } from '@/components/layout/SidePanel'
import { CreateNodeForm } from '@/features/graph-explorer/CreateNodeForm'
import { CreateRelationForm } from '@/features/graph-explorer/CreateRelationForm'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { getFullGraph, querySubgraph } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { cksToReactFlow, traceInferenceChain } from '@/shared/utils/graphUtils'

type CreateMode = 'none' | 'node' | 'relation'

export function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('none')

  const {
    serverUrl,
    sessionId,
    setServerUrl,
    setSessionId,
    error,
    setError,
    setStatus,
    recentSessions,
    recordConnection,
  } = useSessionStore()

  const {
    nodes,
    setNodes,
    setEdges,
    addNodes,
    addEdges,
    selectedNodeId,
    edges,
    setHighlightedEdges,
    clearHighlight,
  } = useGraphStore()

  const handleConnect = useCallback(async () => {
    if (!sessionId.trim()) return
    setIsLoading(true)
    setStatus('connecting')
    setError(null)
    try {
      const subgraph = await getFullGraph(sessionId.trim())
      if (!subgraph.nodes || subgraph.nodes.length === 0) {
        setError(
          'No objects found in this session. Please check session_id and try again.',
        )
        setIsLoading(false)
        return
      }
      const { nodes, edges } = cksToReactFlow(subgraph)
      setNodes(nodes)
      setEdges(edges)
      setStatus('connected')
      recordConnection()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, setStatus, setError, setNodes, setEdges, recordConnection])

  useEffect(() => {
    if (sessionId.trim()) {
      handleConnect()
    }
  }, [sessionId, handleConnect])

  const handleExplore = async () => {
    if (!selectedNodeId || isLoading) return
    setIsLoading(true)
    try {
      const subgraph = await querySubgraph(sessionId, [selectedNodeId], 1)
      if (!subgraph.nodes || subgraph.nodes.length === 0) {
        setError('No neighbours found for this node.')
        setIsLoading(false)
        return
      }
      const { nodes: newNodes, edges: newEdges } = cksToReactFlow(subgraph)
      addNodes(newNodes)
      addEdges(newEdges)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTrace = () => {
    if (!selectedNodeId) return
    const chain = traceInferenceChain(selectedNodeId, edges)
    setHighlightedEdges(chain)
  }

  const handleResetGraph = () => {
    setNodes([])
    setEdges([])
    clearHighlight()
    setSelectedNode(null)
    setError(null)
  }

  const handleSelectRecent = (recent: {
    serverUrl: string
    sessionId: string
  }) => {
    setServerUrl(recent.serverUrl)
    setSessionId(recent.sessionId)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">CKS Studio</h1>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="text"
            placeholder="http://127.0.0.1:8765"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-48 text-gray-200"
          />
          <input
            type="text"
            placeholder="session_id"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-64 text-gray-200"
          />
          <button
            type="button"
            onClick={handleConnect}
            disabled={isLoading || !sessionId.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Connect'}
          </button>
          {recentSessions.length > 0 && (
            <select
              aria-label="Recent sessions"
              value=""
              onChange={(e) => {
                const recent = recentSessions.find(
                  (r) => `${r.serverUrl}|${r.sessionId}` === e.target.value,
                )
                if (recent) handleSelectRecent(recent)
              }}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs max-w-[10rem]"
            >
              <option value="" disabled>
                Recent sessions
              </option>
              {recentSessions.map((r) => (
                <option
                  key={`${r.serverUrl}|${r.sessionId}`}
                  value={`${r.serverUrl}|${r.sessionId}`}
                >
                  {r.sessionId.slice(0, 12)}
                  {r.sessionId.length > 12 ? '…' : ''} ({r.serverUrl})
                </option>
              ))}
            </select>
          )}
        </div>
        {error && <p className="text-red-400 text-xs w-full">{error}</p>}
      </header>
      <div className="flex-1 flex">
        <main className="flex-1">
          <GraphCanvas onNodeSelect={setSelectedNode} />
        </main>
        <aside className="w-72 border-l border-gray-800 bg-gray-900 overflow-y-auto flex flex-col">
          <SidePanel node={selectedNode} />
          <div className="p-4 border-t border-gray-800 space-y-2 mt-auto">
            <button
              type="button"
              onClick={() =>
                setCreateMode((m) => (m === 'node' ? 'none' : 'node'))
              }
              disabled={!sessionId.trim()}
              className="w-full rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMode === 'node' ? 'Close' : 'New object'}
            </button>
            <button
              type="button"
              onClick={() =>
                setCreateMode((m) => (m === 'relation' ? 'none' : 'relation'))
              }
              disabled={!sessionId.trim() || nodes.length < 2}
              title={
                nodes.length < 2
                  ? 'Need at least two objects on the canvas'
                  : undefined
              }
              className="w-full rounded bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMode === 'relation' ? 'Close' : 'New relation'}
            </button>
            <button
              type="button"
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
              type="button"
              onClick={handleTrace}
              disabled={!selectedNodeId}
              className="w-full rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trace Inference
            </button>
            <button
              type="button"
              onClick={clearHighlight}
              className="w-full rounded bg-gray-700 px-4 py-2 text-xs text-gray-300 hover:bg-gray-600"
            >
              Clear Highlight
            </button>
            <button
              type="button"
              onClick={handleResetGraph}
              disabled={nodes.length === 0}
              className="w-full rounded bg-red-900/60 border border-red-800 px-4 py-2 text-xs text-red-200 hover:bg-red-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset graph
            </button>
          </div>
          {createMode === 'node' && (
            <CreateNodeForm
              sessionId={sessionId}
              onCreated={() => setCreateMode('none')}
              onCancel={() => setCreateMode('none')}
            />
          )}
          {createMode === 'relation' && (
            <CreateRelationForm
              sessionId={sessionId}
              onCreated={() => setCreateMode('none')}
              onCancel={() => setCreateMode('none')}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
