import type { Node } from '@xyflow/react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import { TypeLegend } from '@/components/graph/TypeLegend'
import { SidePanel } from '@/components/layout/SidePanel'
import { QuickAiPanel } from '@/features/ai-chat/QuickAiPanel'
import { CreateNodeForm } from '@/features/graph-explorer/CreateNodeForm'
import { CreateRelationForm } from '@/features/graph-explorer/CreateRelationForm'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { StartPipelineButton } from '@/features/graph-explorer/StartPipelineButton'
import { WhyThisBeliefPanel } from '@/features/graph-explorer/WhyThisBeliefPanel'
import { getFullGraph, querySubgraph } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { useSessionEvents } from '@/services/useSessionEvents'
import { cksToReactFlow, traceInferenceChain } from '@/shared/utils/graphUtils'

// three.js (via 3d-force-graph) is ~500KB gzipped -- code-split it into
// its own chunk so switching to 2D-only usage (the default view) never
// pays that cost. Suspense fallback below reuses the same skeleton
// GraphCanvas shows while data is loading, so the loading state looks
// the same regardless of which mode triggered it.
const GraphCanvas3D = lazy(() =>
  import('@/components/graph/GraphCanvas3D').then((m) => ({
    default: m.GraphCanvas3D,
  })),
)

type CreateMode = 'none' | 'node' | 'relation'

export function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('none')
  // Separate from useSessionStore's `error` on purpose: that field also
  // drives `status` (connection health, feeds recentSessions pruning —
  // see sessionStore.ts). A "trying depth 2..." progress message is not
  // a connection failure and must never flip the session to 'error'.
  const [exploreNotice, setExploreNotice] = useState<string | null>(null)

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
    viewMode,
    setViewMode,
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

  // Real-time updates: refresh the graph when the server reports a
  // change (another user/agent committing a version, a gossip conflict,
  // etc.) instead of relying purely on manual refresh. Reuses the same
  // handleConnect() the initial load and manual refresh already use, so
  // there is exactly one code path that (re)loads the graph. No-ops in
  // demo mode and while no session is connected -- see useSessionEvents.
  useSessionEvents({ onRefresh: handleConnect })

  const handleExplore = async () => {
    if (!selectedNodeId || isLoading) return
    setIsLoading(true)
    setExploreNotice(null)
    try {
      // query_subgraph returns the seed node plus its neighbours — on a
      // graph where those neighbours are already on the canvas (the
      // common case: you're exploring from a node you reached via
      // another neighbour), subgraph.nodes is non-empty but every id in
      // it is already present. Checking .length alone treated that as
      // "found neighbours" and returned after a no-op addNodes/addEdges
      // (both dedupe against the existing graph — see
      // graphExplorerStore.ts), so the button did nothing with no
      // feedback. Compare against the *current* canvas node ids instead,
      // so "nothing new" is handled the same way as "nothing at all".
      const currentIds = new Set(nodes.map((n) => n.id))
      const hasNewNodes = (result: {
        nodes?: { identity: { id: string } }[]
      }) => (result.nodes ?? []).some((n) => !currentIds.has(n.identity.id))

      const subgraph = await querySubgraph(sessionId, [selectedNodeId], 1)
      if (hasNewNodes(subgraph)) {
        const { nodes: newNodes, edges: newEdges } = cksToReactFlow(subgraph)
        addNodes(newNodes)
        addEdges(newEdges)
        return
      }

      // depth=1 can legitimately come back with nothing new (isolated
      // ADR/component nodes with no direct edges but reachable
      // neighbours two hops out, or all direct neighbours already on
      // the canvas), so before telling the user there's nothing here,
      // retry once at depth=2.
      setExploreNotice('No new neighbours at depth 1, trying depth 2...')
      const wider = await querySubgraph(sessionId, [selectedNodeId], 2)
      if (!hasNewNodes(wider)) {
        setExploreNotice('No new neighbours found.')
        return
      }
      setExploreNotice(null)
      const { nodes: newNodes, edges: newEdges } = cksToReactFlow(wider)
      addNodes(newNodes)
      addEdges(newEdges)
    } catch (e) {
      setExploreNotice(null)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // Reloads the current session's graph. Reuses handleConnect rather than
  // duplicating its fetch/normalize logic — a manual refresh is
  // functionally the same request as (re)connecting to the same
  // session_id, it just doesn't require the input to have changed.
  const handleRefresh = () => {
    if (!sessionId.trim() || isLoading) return
    handleConnect()
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
      <header className="bg-surface-1 border-b border-border-subtle px-4 py-3 flex items-center gap-4 flex-wrap">
        <h1 className="text-lg font-semibold text-text-primary">CKS Studio</h1>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="text"
            placeholder="http://127.0.0.1:8765"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="bg-surface-2 border border-border rounded px-2 py-1 w-48 text-text-primary placeholder:text-text-tertiary"
          />
          <input
            type="text"
            placeholder="session_id"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="bg-surface-2 border border-border rounded px-2 py-1 w-64 text-text-primary placeholder:text-text-tertiary"
          />
          <button
            type="button"
            onClick={handleConnect}
            disabled={isLoading || !sessionId.trim()}
            className="bg-accent hover:bg-accent-strong text-white px-3 py-1 rounded disabled:opacity-50"
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
              className="bg-surface-2 border border-border rounded px-2 py-1 text-text-primary text-xs max-w-[10rem]"
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
          <fieldset
            aria-label="Graph view mode"
            className="flex items-center rounded border border-border overflow-hidden text-xs m-0 p-0"
          >
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              aria-pressed={viewMode === '2d'}
              className={`px-2.5 py-1 transition-colors ${
                viewMode === '2d'
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              aria-pressed={viewMode === '3d'}
              className={`px-2.5 py-1 transition-colors border-l border-border ${
                viewMode === '3d'
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              3D
            </button>
          </fieldset>
        </div>
        {error && <p className="text-danger text-xs w-full">{error}</p>}
      </header>
      <div className="flex-1 flex">
        <main className="flex-1 relative overflow-hidden">
          {viewMode === '3d' ? (
            <Suspense fallback={<GraphSkeleton />}>
              <GraphCanvas3D
                onNodeSelect={setSelectedNode}
                isLoading={isLoading}
              />
            </Suspense>
          ) : (
            <GraphCanvas
              onNodeSelect={setSelectedNode}
              isLoading={isLoading}
              onRefresh={handleRefresh}
            />
          )}
          <TypeLegend />
          {/* Bottom dock: independent collapsible panels, kept off the
           *  bottom-left corner where TypeLegend already lives. Why panel
           *  centered so it naturally sits "aligned with the selected
           *  node" area of the canvas; Quick AI in the bottom-right,
           *  mirroring where a chat launcher usually lives. Both are
           *  pointer-events-auto islands inside a pointer-events-none
           *  strip so the graph underneath stays fully interactive
           *  everywhere else along the bottom edge. */}
          <div className="absolute inset-x-0 bottom-3 z-10 flex items-end justify-center gap-2 px-3 pointer-events-none">
            <div className="pointer-events-auto">
              <WhyThisBeliefPanel
                selectedNodeId={selectedNodeId}
                selectedNodeLabel={
                  (selectedNode?.data?.label as string | undefined) ?? null
                }
              />
            </div>
          </div>
          <div className="absolute bottom-3 right-3 z-10">
            <QuickAiPanel />
          </div>
        </main>
        {/* relative + z-10: в 3D-режиме GraphCanvas3D монтирует свой
         *  WebGL-canvas через three.js вне обычного React-дерева стилей
         *  ReactFlow, из-за чего он мог создавать собственный stacking
         *  context поверх соседних элементов flex-раскладки. relative
         *  явно заводит для aside свой stacking context, а z-10 гарантирует,
         *  что панель остаётся над 3D-холстом независимо от режима. */}
        <aside className="relative z-10 w-72 border-l border-border-subtle bg-surface-1 overflow-y-auto flex flex-col">
          <SidePanel node={selectedNode} />
          <div className="p-4 border-t border-border-subtle space-y-2 mt-auto">
            <button
              type="button"
              onClick={() =>
                setCreateMode((m) => (m === 'node' ? 'none' : 'node'))
              }
              disabled={!sessionId.trim()}
              className="w-full rounded bg-brand px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full rounded bg-surface-3 px-4 py-2 text-sm font-medium text-text-primary hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMode === 'relation' ? 'Close' : 'New relation'}
            </button>
            <button
              type="button"
              onClick={handleExplore}
              disabled={!selectedNodeId || isLoading}
              className="w-full rounded bg-surface-3 px-4 py-2 text-sm font-medium text-text-primary hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-primary border-t-transparent" />
                  Loading...
                </>
              ) : (
                'Explore Neighbourhood'
              )}
            </button>
            {exploreNotice && (
              <p className="text-xs text-text-secondary">{exploreNotice}</p>
            )}
            <button
              type="button"
              onClick={handleTrace}
              disabled={!selectedNodeId}
              className="w-full rounded bg-surface-3 px-4 py-2 text-sm font-medium text-text-primary hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trace Inference
            </button>
            <StartPipelineButton sessionId={sessionId} />
            <button
              type="button"
              onClick={clearHighlight}
              className="w-full rounded bg-surface-3 px-4 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-border"
            >
              Clear Highlight
            </button>
            <button
              type="button"
              onClick={handleResetGraph}
              disabled={nodes.length === 0}
              className="w-full rounded bg-danger/15 border border-danger/40 px-4 py-2 text-xs text-danger hover:bg-danger/25 disabled:opacity-40 disabled:cursor-not-allowed"
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
