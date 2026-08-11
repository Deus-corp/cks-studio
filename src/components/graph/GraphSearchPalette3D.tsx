// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { nodeTypeColor, nodeTypeIcon } from '@/shared/constants/nodeTypes'

/**
 * 3D counterpart to GraphSearchPalette. Same ⌘K quick-jump UX, but calls
 * `onFocusNode` (which flies the three.js camera to the node -- see
 * GraphCanvas3D's onNodeClick camera logic) instead of xyflow's
 * setCenter/fitView, since there's no ReactFlowProvider around the 3D
 * canvas for useReactFlow() to read.
 */
export function GraphSearchPalette3D({
  onFocusNode,
  isOpen: controlledOpen,
  onOpenChange,
}: {
  onFocusNode: (nodeId: string) => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const nodes = useGraphStore((s) => s.nodes)
  const selectNode = useGraphStore((s) => s.selectNode)

  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setInternalOpen((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        onOpenChange?.(next)
        return next
      })
    },
    [onOpenChange],
  )
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isModK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isModK) {
        event.preventDefault()
        setIsOpen((open) => !open)
        return
      }
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setIsOpen])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? nodes.filter(
          (node) =>
            (node.data?.label as string | undefined)
              ?.toLowerCase()
              .includes(q) || node.id.toLowerCase().includes(q),
        )
      : nodes
    return pool.slice(0, 30)
  }, [nodes, query])

  if (!isOpen) return null

  function jumpTo(nodeId: string) {
    selectNode(nodeId)
    onFocusNode(nodeId)
    setIsOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = results[activeIndex]
      if (target) jumpTo(target.id)
    }
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center pt-[15vh] bg-surface-0/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to node"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-md bg-surface-1 border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-text-tertiary shrink-0"
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
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to node by name or id…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <kbd className="text-[10px] font-mono text-text-tertiary border border-border-subtle rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-tertiary text-center">
              No nodes match "{query}".
            </p>
          )}
          {results.map((node, index) => {
            const cksType = (node.data?.cksType as string) || 'Concept'
            const color = nodeTypeColor(cksType)
            return (
              <button
                key={node.id}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => jumpTo(node.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  index === activeIndex
                    ? 'bg-surface-2'
                    : 'hover:bg-surface-2/60'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span aria-hidden="true" className="text-[11px]">
                  {nodeTypeIcon(cksType)}
                </span>
                <span className="flex-1 truncate text-sm text-text-primary">
                  {(node.data?.label as string) || node.id}
                </span>
                <span className="text-[10px] font-mono text-text-tertiary truncate max-w-[6rem]">
                  {node.id}
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-3 py-1.5 border-t border-border-subtle flex items-center gap-3 text-[10px] text-text-tertiary">
          <span>↑↓ navigate</span>
          <span>↵ jump</span>
        </div>
      </div>
    </div>
  )
}
