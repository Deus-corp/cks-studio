// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { requestProcessStop, startPipeline } from '@/services/mcpTools'

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
  const [isStopping, setIsStopping] = useState(false)
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

  const handleStop = async () => {
    if (isStopping) return
    setIsStopping(true)
    setResult(null)
    try {
      const res = await requestProcessStop('pipeline')
      if ('found' in res && res.found === false) {
        setResult({
          kind: 'error',
          message:
            'No pipeline process has ever reported in — nothing to stop.',
        })
      } else if ('accepted' in res && res.accepted) {
        setResult({
          kind: 'success',
          message:
            'Stop requested — the pipeline agent will wind down shortly.',
        })
      } else {
        setResult({
          kind: 'error',
          message: 'Stop request was not accepted.',
        })
      }
    } catch (e) {
      setResult({
        kind: 'error',
        message:
          e instanceof Error ? e.message : 'Failed to request pipeline stop.',
      })
    } finally {
      setIsStopping(false)
    }
  }

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={count === 0 || isStarting || !sessionId.trim()}
          title={
            count === 0
              ? 'Select one or more nodes (Ctrl/Cmd+click) to start a pipeline'
              : undefined
          }
          className="flex-1 min-w-0 rounded bg-brand px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        <button
          type="button"
          onClick={handleStop}
          disabled={isStopping}
          title="Request the running pipeline agent to stop"
          className="flex-shrink-0 rounded border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-danger disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStopping ? '…' : 'Stop'}
        </button>
      </div>
      {result && (
        <p
          className={`text-xs break-all overflow-hidden max-w-full ${
            result.kind === 'success' ? 'text-green-400' : 'text-danger'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}
