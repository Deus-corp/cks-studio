// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import { IconButton } from '@/components/common/IconButton'
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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={count === 0 || isStarting || !sessionId.trim()}
          title={
            count === 0
              ? 'Select one or more nodes (Ctrl/Cmd+click) to start a pipeline'
              : `Start a pipeline run for ${count} selected object${count === 1 ? '' : 's'}`
          }
          className="flex-1 min-w-0 rounded bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary hover:bg-border hover:border-border disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
        >
          {isStarting ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent shrink-0" />
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M6 4.5v15l14-7.5-14-7.5z" />
            </svg>
          )}
          <span className="truncate">
            {isStarting ? 'Starting…' : 'Start Pipeline'}
          </span>
          {!isStarting && count > 0 && (
            <span className="shrink-0 text-[10px] leading-none bg-surface-1 border border-border-subtle rounded-full px-1.5 py-0.5 text-text-secondary">
              ({count})
            </span>
          )}
        </button>
        <IconButton
          onClick={handleStop}
          disabled={isStopping}
          label="Stop pipeline"
          title="Request the running pipeline agent to stop"
          className="!shadow-none !bg-surface-3 hover:!border-danger hover:!text-danger"
          icon={
            isStopping ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="5" y="5" width="14" height="14" rx="1.5" />
              </svg>
            )
          }
        />
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
