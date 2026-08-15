// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import type {
  PipelineRun,
  PipelineRunStatus,
  PipelineStepStatus,
} from './types'

/** Shortens a run_id for compact display, e.g. run-7f2a9c1e-0001 -> 7f2a9c1e…0001. */
export function truncateRunId(runId: string): string {
  const parts = runId.split('-')
  // Expect a "run-<uuid-chunk>-<seq>" shape; anything shorter is shown as-is.
  if (parts.length < 3) return runId
  const [, ...rest] = parts
  return `${rest[0]}…${rest[rest.length - 1]}`
}

/** Most recently updated run first. */
export function sortRunsByUpdatedAt(runs: PipelineRun[]): PipelineRun[] {
  return [...runs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function filterRunsByStatus(
  runs: PipelineRun[],
  status: PipelineRunStatus | 'all',
): PipelineRun[] {
  if (status === 'all') return runs
  return runs.filter((r) => r.status === status)
}

export const RUN_STATUS_COLORS: Record<PipelineRunStatus, string> = {
  queued: '#6b7280',
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
}

export const RUN_STATUS_LABELS: Record<PipelineRunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

export const STEP_STATUS_COLORS: Record<PipelineStepStatus, string> = {
  pending: '#6b7280',
  active: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
}

export const STEP_STATUS_LABELS: Record<PipelineStepStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  failed: 'Failed',
}
