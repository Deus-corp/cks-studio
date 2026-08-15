// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useMemo, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { useSessionStore } from '@/services/sessionStore'
import {
  DEFAULT_NODE_TYPE_COLOR,
  nodeTypeColor,
} from '@/shared/constants/nodeTypes'
import { withAlpha } from '@/shared/utils/colorUtils'

/**
 * Interactive legend of node colors by CKS type. Doubles as a type
 * filter: clicking a row toggles that type's visibility on the canvas
 * (see hiddenTypes in graphExplorerStore, consumed by GraphCanvas).
 *
 * The type list is derived from the nodes actually on the canvas rather
 * than the fixed NODE_TYPE_COLORS map, so the legend never shows a type
 * that isn't present and never omits an unknown one either — useful on
 * large graphs where filtering out one type helps the rest breathe.
 */
type PanelView = 'types' | 'stats'

export function TypeLegend() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const hiddenTypes = useGraphStore((s) => s.hiddenTypes)
  const multiSelectedIds = useGraphStore((s) => s.multiSelectedIds)
  const toggleTypeVisibility = useGraphStore((s) => s.toggleTypeVisibility)
  const showAllTypes = useGraphStore((s) => s.showAllTypes)
  const sessionId = useSessionStore((s) => s.sessionId)

  // Collapsed by default would hide the filter affordance the first
  // time someone opens a graph, so start expanded (matching the legend's
  // pre-existing always-shown look) and let the person collapse it once
  // they know it's there.
  const [isExpanded, setIsExpanded] = useState(true)

  // Which of the two views (node types / graph stats) is showing inside
  // the expanded panel. Kept as separate state from isExpanded so the
  // choice survives re-renders while the panel stays open; it's fine for
  // this to just reset to 'types' on collapse/re-expand (see task notes).
  const [view, setView] = useState<PanelView>('types')

  const types = useMemo(() => {
    const set = new Set<string>()
    for (const node of nodes) {
      set.add((node.data?.cksType as string) || 'Concept')
    }
    return Array.from(set).sort()
  }, [nodes])

  const visibleTypeCount = useMemo(
    () => types.filter((type) => !hiddenTypes.has(type)).length,
    [types, hiddenTypes],
  )

  // Cheap O(nodes + edges) degree count -- fine to compute on every
  // render since it only runs while the stats view is actually visible
  // and graphs here top out in the low thousands of nodes.
  const maxDegree = useMemo(() => {
    if (view !== 'stats' || nodes.length === 0) return null
    const degree = new Map<string, number>()
    for (const edge of edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
    }
    let best: { id: string; count: number } | null = null
    for (const [id, count] of degree) {
      if (!best || count > best.count) best = { id, count }
    }
    if (!best) return null
    const node = nodes.find((n) => n.id === best?.id)
    const label = (node?.data?.label as string) || best.id
    return { label, count: best.count }
  }, [view, nodes, edges])

  if (types.length === 0) return null

  if (!isExpanded) {
    // Collapsed: just the small "Node types" label/button, compact
    // enough to sit in the corner without obstructing the canvas.
    return (
      <div className="absolute bottom-[15px] left-[15px] z-10">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-expanded={false}
          title="Show node type legend"
          className="bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md px-3 py-2 text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary shadow-lg transition-colors select-none"
        >
          Node types
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-[15px] left-[15px] z-10 bg-surface-1/90 backdrop-blur-sm border border-border-subtle rounded-md px-3 py-2 text-xs text-text-secondary space-y-1.5 select-none shadow-lg min-w-[168px]">
      <div className="flex items-center justify-between gap-3 pb-0.5">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          aria-expanded={true}
          title="Collapse panel"
          className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
        >
          {view === 'types' ? 'Node types' : 'Graph stats'}
        </button>
        <div className="flex items-center gap-2">
          {view === 'types' && hiddenTypes.size > 0 && (
            <button
              type="button"
              onClick={showAllTypes}
              className="text-[10px] text-text-tertiary hover:text-text-secondary"
            >
              Show all
            </button>
          )}
          <button
            type="button"
            onClick={() => setView(view === 'types' ? 'stats' : 'types')}
            title={view === 'types' ? 'Show graph stats' : 'Show node types'}
            className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary border border-border-subtle hover:border-border rounded px-1.5 py-0.5 transition-colors"
          >
            {view === 'types' ? 'Stats' : 'Types'}
          </button>
        </div>
      </div>
      {view === 'stats' ? (
        <div className="space-y-1 py-0.5 min-w-[140px]">
          <StatRow
            label="Graph"
            value={sessionId ? sessionId : 'Untitled graph'}
          />
          <StatRow label="Nodes" value={String(nodes.length)} />
          <StatRow label="Edges" value={String(edges.length)} />
          <StatRow
            label="Visible types"
            value={`${visibleTypeCount} / ${types.length}`}
          />
          {multiSelectedIds.size > 0 && (
            <StatRow label="Selected" value={String(multiSelectedIds.size)} />
          )}
          {maxDegree && (
            <StatRow
              label="Most connected"
              value={`${maxDegree.label} (${maxDegree.count})`}
            />
          )}
        </div>
      ) : (
        types.map((type) => {
          const color = nodeTypeColor(type) ?? DEFAULT_NODE_TYPE_COLOR
          const isHidden = hiddenTypes.has(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleTypeVisibility(type)}
              aria-pressed={!isHidden}
              title={isHidden ? `Show ${type} nodes` : `Hide ${type} nodes`}
              className={`flex items-center gap-2 w-full text-left rounded px-1 py-0.5 -mx-1 transition-opacity hover:bg-surface-2 ${
                isHidden ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: isHidden ? 'transparent' : color,
                  borderColor: color,
                }}
              >
                {!isHidden && (
                  <svg
                    viewBox="0 0 10 10"
                    className="w-2 h-2"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 5l2.5 2.5L9 2"
                      stroke="var(--color-surface-0)"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 0 3px ${withAlpha(color, 0.1)}`,
                }}
              />
              <span className="font-display text-[11px] font-medium tracking-wide text-text-primary truncate">
                {type}
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}

/** One label/value row in the graph-stats view. */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <span
        className="font-display text-[11px] font-medium text-text-primary truncate max-w-[110px]"
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
