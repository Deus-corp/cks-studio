// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { startPipeline } from '@/services/mcpTools'

/**
 * Kicks off an ADR-007 agent pipeline run for the graph's current
 * multi-selection (see graphExplorerStore's multiSelectedIds -- populated
 * from GraphCanvas/GraphCanvas3D's Ctrl/Cmd+click handling). Lives in the
 * GraphPage sidebar next to the other selection-driven actions
 * (Explore Neighbourhood, Trace Inference).
 */
export function StartPipelineButton({ sessionId }: { sessionId: string }) {
  const multiSelectedIds = useGraphStore((s) => s.multiSelectedIds)
  const clearMultiSelect = useGraphStore((s) => s.clearMultiSelect)
  const [isStarting, setIsStarting] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
    | null
  >(null)

  const count = multiSelectedIds.size

  const handleClick = async () => {
    if (count === 0 || isStarting || !sessionId.trim()) return
    setIsStarting(true)
    setResult(null)
    try {
      const objectIds = Array.from(multiSelectedIds)
      const { run_id } = await startPipeline(sessionId.trim(), objectIds)
      setResult({
        kind: 'success',
        message: `Pipeline started with ${objectIds.length} object${
          objectIds.length === 1 ? '' : 's'
        } (run ${run_id}).`,
      })
      clearMultiSelect()
    } catch (e) {
      setResult({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to start pipeline.',
      })
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={count === 0 || isStarting || !sessionId.trim()}
        title={
          count === 0
            ? 'Select one or more nodes (Ctrl/Cmd+click) to start a pipeline'
            : undefined
        }
        className="w-full rounded bg-brand px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isStarting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-text border-t-transparent" />
            Starting…
          </>
        ) : (
          `Start Pipeline${count > 0 ? ` (${count})` : ''}`
        )}
      </button>
      {result && (
        <p
          className={`text-xs ${
            result.kind === 'success' ? 'text-green-400' : 'text-danger'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}
