import type { Node } from '@xyflow/react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { IconButton } from '@/components/common/IconButton'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import { TypeLegend } from '@/components/graph/TypeLegend'
import { SidePanel } from '@/components/layout/SidePanel'
import { QuickAiPanel } from '@/features/ai-chat/QuickAiPanel'
import { CrossGraphLinkForm } from '@/features/cross-graph/CrossGraphLinkForm'
import { CreateNodeForm } from '@/features/graph-explorer/CreateNodeForm'
import { CreateRelationForm } from '@/features/graph-explorer/CreateRelationForm'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { StartPipelineButton } from '@/features/graph-explorer/StartPipelineButton'
import { WhyThisBeliefPanel } from '@/features/graph-explorer/WhyThisBeliefPanel'
import { PublishToGalleryButton } from '@/features/graph-gallery/PublishToGalleryButton'
import { getFullGraph, querySubgraph } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { useSessionEvents } from '@/services/useSessionEvents'
import { useSettingsStore } from '@/shared/stores/settingsStore'
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

type CreateMode = 'none' | 'node' | 'relation' | 'link'

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
  const showTypeLegend = useSettingsStore((s) => s.showTypeLegend)
  const sseRefreshDebounceMs = useSettingsStore((s) => s.sseRefreshDebounceMs)
  const autoReconnectSse = useSettingsStore((s) => s.autoReconnectSse)

  useSessionEvents({
    onRefresh: handleConnect,
    debounceMs: sseRefreshDebounceMs,
    // autoReconnectSse === false disables the live-events subscription
    // entirely (a null/empty session id short-circuits useSessionEvents'
    // connect effect the same way), rather than requiring a separate
    // "auto-reconnect" concept inside sessionEvents.ts.
    eventTypes: autoReconnectSse ? undefined : [],
  })

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
          {showTypeLegend && <TypeLegend />}
          {/* Bottom dock: independent collapsible panels, kept off the
           *  bottom-left corner where TypeLegend already lives.
           *
           *  Why panel: centered, so it naturally sits "aligned with the
           *  selected node" area of the canvas. In 3D mode it's raised
           *  above 3d-force-graph's own built-in nav-info hint ("Left-
           *  click: rotate, Mouse-wheel/middle-click: zoom, Right-click:
           *  pan" -- see .scene-nav-info in 3d-force-graph's bundled CSS),
           *  which is centered across the full canvas width at ~bottom:
           *  5px and would otherwise sit right under the collapsed tab.
           *
           *  Quick AI: bottom-right in 3D (no minimap there), but nudged
           *  left of react-flow's MiniMap in 2D mode (MiniMap defaults to
           *  bottom-right with a 15px @xyflow/react panel margin and a
           *  ~200px width) so the two don't overlap.
           *
           *  Both are pointer-events-auto islands inside a pointer-
           *  events-none strip/wrapper so the graph underneath stays
           *  fully interactive everywhere else along the bottom edge. */}
          <div
            className={`absolute inset-x-0 z-10 flex items-end justify-center gap-2 px-3 pointer-events-none ${
              viewMode === '3d' ? 'bottom-[21px]' : 'bottom-[15px]'
            }`}
          >
            <div className="pointer-events-auto">
              <WhyThisBeliefPanel
                selectedNodeId={selectedNodeId}
                selectedNodeLabel={
                  (selectedNode?.data?.label as string | undefined) ?? null
                }
              />
            </div>
          </div>
          <div
            className={`absolute bottom-[15px] z-10 ${
              viewMode === '3d' ? 'right-3' : 'right-[228px]'
            }`}
          >
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
            {/* Compact icon toolbar for the five most-used graph-editing
             *  actions -- each button carries its full name as a tooltip
             *  (title) and accessible name (aria-label) via IconButton,
             *  so nothing here is icon-only in the accessibility tree. */}
            <div className="grid grid-cols-5 gap-1.5">
              <IconButton
                size="md"
                onClick={() =>
                  setCreateMode((m) => (m === 'node' ? 'none' : 'node'))
                }
                disabled={!sessionId.trim()}
                active={createMode === 'node'}
                label={
                  createMode === 'node' ? 'Close new object form' : 'New object'
                }
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 9v6M9 12h6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />
              <IconButton
                size="md"
                onClick={() =>
                  setCreateMode((m) => (m === 'relation' ? 'none' : 'relation'))
                }
                disabled={!sessionId.trim() || nodes.length < 2}
                active={createMode === 'relation'}
                label={
                  createMode === 'relation'
                    ? 'Close new relation form'
                    : 'New relation'
                }
                title={
                  nodes.length < 2
                    ? 'Need at least two objects on the canvas'
                    : undefined
                }
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="5"
                      cy="12"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle
                      cx="19"
                      cy="12"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M7.5 12h9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />
              <IconButton
                size="md"
                onClick={() =>
                  setCreateMode((m) => (m === 'link' ? 'none' : 'link'))
                }
                disabled={!sessionId.trim() || !selectedNodeId}
                active={createMode === 'link'}
                label={
                  createMode === 'link'
                    ? 'Close cross-graph link form'
                    : 'Cross-graph link'
                }
                title={
                  !selectedNodeId
                    ? 'Select an object on the canvas first'
                    : undefined
                }
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 15l6-6M8.5 8.5L7 7a3 3 0 00-4.24 4.24L4.5 13M15.5 15.5L17 17a3 3 0 004.24-4.24L19.5 11"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
              <IconButton
                size="md"
                onClick={handleExplore}
                disabled={!selectedNodeId || isLoading}
                label="Explore neighbourhood"
                icon={
                  isLoading ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="6"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <circle
                        cx="6"
                        cy="16"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <circle
                        cx="18"
                        cy="16"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8v3M10.5 11l-3 3.3M13.5 11l3 3.3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )
                }
              />
              <IconButton
                size="md"
                onClick={handleTrace}
                disabled={!selectedNodeId}
                label="Trace inference"
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 18h4l3-12 3 12h4M4 6h4l1 4M15 14l1 4h4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
            </div>
            {exploreNotice && (
              <p className="text-xs text-text-secondary">{exploreNotice}</p>
            )}
            <StartPipelineButton sessionId={sessionId} />
            <PublishToGalleryButton sessionId={sessionId} />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={clearHighlight}
                className="flex-1 rounded bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-border hover:border-border flex items-center justify-center gap-1.5 transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                Clear Highlight
              </button>
              <IconButton
                onClick={handleResetGraph}
                disabled={nodes.length === 0}
                label="Reset graph"
                className="!bg-danger/15 !border-danger/40 text-danger hover:!bg-danger/25 hover:!text-danger"
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
            </div>
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
          {createMode === 'link' && selectedNodeId && (
            <CrossGraphLinkForm
              sessionId={sessionId}
              objectId={selectedNodeId}
              objectLabel={
                (selectedNode?.data?.label as string | undefined) ??
                selectedNodeId
              }
              onLinked={() => setCreateMode('none')}
              onCancel={() => setCreateMode('none')}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
