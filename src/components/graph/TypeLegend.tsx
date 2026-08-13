// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useMemo, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  DEFAULT_NODE_TYPE_COLOR,
  nodeTypeColor,
  nodeTypeIcon,
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
export function TypeLegend() {
  const nodes = useGraphStore((s) => s.nodes)
  const hiddenTypes = useGraphStore((s) => s.hiddenTypes)
  const toggleTypeVisibility = useGraphStore((s) => s.toggleTypeVisibility)
  const showAllTypes = useGraphStore((s) => s.showAllTypes)

  // Collapsed by default would hide the filter affordance the first
  // time someone opens a graph, so start expanded (matching the legend's
  // pre-existing always-shown look) and let the person collapse it once
  // they know it's there.
  const [isExpanded, setIsExpanded] = useState(true)

  const types = useMemo(() => {
    const set = new Set<string>()
    for (const node of nodes) {
      set.add((node.data?.cksType as string) || 'Concept')
    }
    return Array.from(set).sort()
  }, [nodes])

  if (types.length === 0) return null

  if (!isExpanded) {
    // Collapsed: just the small "Node types" label/button, compact
    // enough to sit in the corner without obstructing the canvas.
    return (
      <div className="absolute bottom-3 left-3 z-10">
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
    <div className="absolute bottom-3 left-3 z-10 bg-surface-1/95 backdrop-blur-sm border border-border-subtle rounded-md px-3 py-2 text-xs text-text-secondary space-y-1.5 select-none shadow-lg">
      <div className="flex items-center justify-between gap-3 pb-0.5">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          aria-expanded={true}
          title="Collapse node type legend"
          className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
        >
          Node types
        </button>
        {hiddenTypes.size > 0 && (
          <button
            type="button"
            onClick={showAllTypes}
            className="text-[10px] text-accent hover:text-accent-strong"
          >
            Show all
          </button>
        )}
      </div>
      {types.map((type) => {
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
                <svg viewBox="0 0 10 10" className="w-2 h-2" aria-hidden="true">
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
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 0 3px ${withAlpha(color, 0.18)}`,
              }}
            />
            <span aria-hidden="true" className="text-[10px] leading-none">
              {nodeTypeIcon(type)}
            </span>
            <span className="font-display text-[11px] font-medium tracking-wide text-text-primary">
              {type}
            </span>
          </button>
        )
      })}
    </div>
  )
}
