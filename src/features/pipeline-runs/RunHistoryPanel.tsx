// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '@/services/sessionStore'
import { IS_MOCK_DATA, loadPipelineRuns } from './mockRuns'
import {
  RUN_STATUS_COLORS,
  RUN_STATUS_LABELS,
  STEP_STATUS_COLORS,
  STEP_STATUS_LABELS,
  sortRunsByUpdatedAt,
  truncateRunId,
} from './pipelineRunUtils'
import type { PipelineRun } from './types'
import { stepsCompletedCount } from './types'

/**
 * Run History section for PipelinePage -- lists recent ADR-007 pipeline
 * runs (Researcher -> Synthesizer -> Reviewer -> Arbiter) started via
 * StartPipelineButton, and lets you drill into per-step status/timestamps/
 * errors for a single run.
 *
 * Backed by the real `list_pipeline_runs` MCP tool via `loadPipelineRuns`
 * (see mockRuns.ts) -- swapping the loader for a different data source
 * only touches `load()` below.
 */
export function RunHistoryPanel() {
  const { sessionId } = useSessionStore()
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await loadPipelineRuns(sessionId.trim())
      setRuns(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load captures sessionId by value, recreating when it changes is expected
  useEffect(() => {
    load()
  }, [sessionId])

  const sorted = useMemo(() => sortRunsByUpdatedAt(runs), [runs])

  return (
    <div className="border-t border-border-subtle flex flex-col max-h-80">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Run History</h2>
        {IS_MOCK_DATA && (
          <span className="text-[10px] uppercase tracking-wide bg-surface-3 text-text-tertiary px-1.5 py-0.5 rounded">
            Demo/mock — backend connection needed
          </span>
        )}
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="ml-auto text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs px-4 py-2">{error}</p>}

      {!error && sorted.length === 0 && !isLoading && (
        <p className="text-xs text-text-tertiary px-4 py-2">
          No pipeline runs yet — use Start Pipeline on the Graph page to enqueue
          one.
        </p>
      )}

      <div className="flex-1 overflow-y-auto">
        {sorted.map((run) => {
          const isExpanded = run.runId === expandedRunId
          return (
            <div key={run.runId} className="border-b border-border-subtle">
              <button
                type="button"
                onClick={() =>
                  setExpandedRunId((prev) =>
                    prev === run.runId ? null : run.runId,
                  )
                }
                className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-surface-2 text-xs"
              >
                <span
                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: RUN_STATUS_COLORS[run.status] }}
                />
                <span className="font-mono text-text-primary">
                  {truncateRunId(run.runId)}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    color: RUN_STATUS_COLORS[run.status],
                    backgroundColor: `${RUN_STATUS_COLORS[run.status]}22`,
                  }}
                >
                  {RUN_STATUS_LABELS[run.status]}
                </span>
                <span className="text-text-tertiary">{run.updatedAt}</span>
                <span className="text-text-tertiary ml-auto">
                  {run.objectIds.length} object
                  {run.objectIds.length === 1 ? '' : 's'}
                </span>
                <span className="text-text-tertiary">
                  {stepsCompletedCount(run)}/{run.steps.length} steps
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-1.5">
                  {run.steps.map((step) => (
                    <div
                      key={step.name}
                      className="flex items-start gap-2 text-xs bg-surface-1 rounded px-2 py-1.5"
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block mt-0.5 flex-shrink-0"
                        style={{
                          backgroundColor: STEP_STATUS_COLORS[step.status],
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">
                            {step.name}
                          </span>
                          <span
                            style={{ color: STEP_STATUS_COLORS[step.status] }}
                          >
                            {STEP_STATUS_LABELS[step.status]}
                          </span>
                          {step.startedAt && (
                            <span className="text-text-tertiary ml-auto">
                              {step.startedAt}
                              {step.completedAt ? ` → ${step.completedAt}` : ''}
                            </span>
                          )}
                        </div>
                        {step.error && (
                          <p className="text-danger mt-1">
                            {step.error}
                            {step.deadLetterTaskId != null && (
                              <> (dead-letter task #{step.deadLetterTaskId})</>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
