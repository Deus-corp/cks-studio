// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useRef, useState } from 'react'
import { IconButton } from '@/components/common/IconButton'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  getProcessStatus,
  requestProcessStop,
  startPipeline,
} from '@/services/mcpTools'

/** How long a success/error message stays visible before auto-dismissing. */
const MESSAGE_TTL_MS = 5000
/** How often to re-check whether a pipeline process has ever reported in
 *  (matches useProcessesPolling's default interval — see its comment for
 *  why 10s is a reasonable balance of responsiveness vs. load). */
const LIVENESS_POLL_MS = 10_000

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
  // null = liveness not checked yet (fail open: don't hide the button
  // before we actually know). false = process_status came back
  // "not found" -- no pipeline process has ever reported a heartbeat.
  const [pipelineEverSeen, setPipelineEverSeen] = useState<boolean | null>(null)

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set right before we clear the selection ourselves after a successful
  // start, so the selection-change effect below doesn't treat our own
  // clearMultiSelect() call as "the user picked something new" and wipe
  // the success message we just showed.
  const suppressNextSelectionClearRef = useRef(false)

  const clearDismissTimer = () => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }

  const showResult = (
    next: { kind: 'success' | 'error'; message: string } | null,
  ) => {
    clearDismissTimer()
    setResult(next)
    if (next !== null) {
      dismissTimerRef.current = setTimeout(() => {
        setResult(null)
        dismissTimerRef.current = null
      }, MESSAGE_TTL_MS)
    }
  }

  // Clear any stale message as soon as the selection changes -- otherwise
  // a "Pipeline started..." success message from a previous selection
  // lingers on screen indefinitely while the user picks new nodes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scoped to multiSelectedIds only
  useEffect(() => {
    if (suppressNextSelectionClearRef.current) {
      suppressNextSelectionClearRef.current = false
      return
    }
    clearDismissTimer()
    setResult(null)
  }, [multiSelectedIds])

  // Unmount-only cleanup for any pending auto-dismiss timer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on unmount
  useEffect(() => {
    return () => clearDismissTimer()
  }, [])

  // Poll whether a pipeline process has ever reported a heartbeat, so the
  // Stop button doesn't offer an action that's guaranteed to fail with
  // "nothing to stop" -- see graph_health_sweeper's process_status shape
  // for the ProcessNotFound case this checks against.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const status = await getProcessStatus('pipeline')
        if (cancelled) return
        setPipelineEverSeen(!('found' in status && status.found === false))
      } catch {
        // A network/protocol error here shouldn't itself hide the Stop
        // button -- fail open rather than mask a real running process.
        if (!cancelled) setPipelineEverSeen(true)
      }
    }
    check()
    const timer = setInterval(check, LIVENESS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const count = multiSelectedIds.size

  const handleClick = async () => {
    if (count === 0 || isStarting || !sessionId.trim()) return
    setIsStarting(true)
    showResult(null)
    try {
      const objectIds = Array.from(multiSelectedIds)
      const { run_id } = await startPipeline(sessionId.trim(), objectIds)
      showResult({
        kind: 'success',
        message: `Pipeline started with ${objectIds.length} object${
          objectIds.length === 1 ? '' : 's'
        } (run ${run_id}).`,
      })
      suppressNextSelectionClearRef.current = true
      clearMultiSelect()
    } catch (e) {
      showResult({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to start pipeline.',
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    if (isStopping || pipelineEverSeen === false) return
    setIsStopping(true)
    showResult(null)
    try {
      const res = await requestProcessStop('pipeline')
      if ('found' in res && res.found === false) {
        setPipelineEverSeen(false)
        showResult({
          kind: 'error',
          message:
            'No pipeline process has ever reported in — nothing to stop.',
        })
      } else if ('accepted' in res && res.accepted) {
        showResult({
          kind: 'success',
          message:
            'Stop requested — the pipeline agent will wind down shortly.',
        })
      } else {
        showResult({
          kind: 'error',
          message: 'Stop request was not accepted.',
        })
      }
    } catch (e) {
      showResult({
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
          className="flex-1 min-w-0 rounded bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary hover:bg-border hover:border-border disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5 shadow-lg transition-colors"
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
        {pipelineEverSeen !== false && (
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
        )}
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
