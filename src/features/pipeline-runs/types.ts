// Copyright (c) 2026 Deus Corp. Licensed under MIT.

/**
 * Run History data model (ADR-007 pipeline: Researcher -> Synthesizer ->
 * Reviewer -> Arbiter, orchestrated by CKSAgentOrchestrator in cks-mcp).
 *
 * There is currently no MCP tool that returns this shape. `start_pipeline`
 * only returns a `run_id` + `status` at enqueue time (see startPipeline in
 * src/services/mcpTools.ts), and per-object `current_status`/`transition_log`
 * (read via getFullGraph, see pipeline-monitor/pipelineUtils.ts) describe
 * where a single *object* is in the pipeline -- not a run as a whole, and
 * they don't carry step-level timestamps/errors for a specific run_id.
 *
 * Until a `list_pipeline_runs` tool exists on the backend, this feature is
 * driven by a deterministic mock dataset (see mockRuns.ts). The component
 * layer is written against this same shape so swapping the mock loader for
 * a real MCP call is a one-line change.
 */

export const PIPELINE_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
] as const

export type PipelineRunStatus = (typeof PIPELINE_RUN_STATUSES)[number]

export const PIPELINE_STEP_NAMES = [
  'Researcher',
  'Synthesizer',
  'Reviewer',
  'Arbiter',
] as const

export type PipelineStepName = (typeof PIPELINE_STEP_NAMES)[number]

export const PIPELINE_STEP_STATUSES = [
  'pending',
  'active',
  'completed',
  'failed',
] as const

export type PipelineStepStatus = (typeof PIPELINE_STEP_STATUSES)[number]

export interface PipelineRunStep {
  name: PipelineStepName
  status: PipelineStepStatus
  startedAt: string | null
  completedAt: string | null
  /** Set when status === 'failed'. */
  error?: string | null
  /** task_id of a matching entry in the dead-letter inbox, if any (see
   *  src/services/mcpTools.ts DeadLetterTask / DeadLetterPage). */
  deadLetterTaskId?: number | null
}

export interface PipelineRun {
  runId: string
  sessionId: string
  status: PipelineRunStatus
  startedAt: string
  updatedAt: string
  /** object_ids passed to start_pipeline for this run. */
  objectIds: string[]
  steps: PipelineRunStep[]
}

export function stepsCompletedCount(run: PipelineRun): number {
  return run.steps.filter((s) => s.status === 'completed').length
}
