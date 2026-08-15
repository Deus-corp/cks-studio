// Copyright (c) 2026 Deus Corp. Licensed under MIT.

/**
 * Run History data model (ADR-007 pipeline: Researcher -> Synthesizer ->
 * Reviewer -> Arbiter, orchestrated by CKSAgentOrchestrator in cks-mcp).
 *
 * Backed by the `list_pipeline_runs` MCP tool (cks-mcp
 * src/cks_mcp/tools/list_pipeline_runs) via `listPipelineRuns` in
 * src/services/mcpTools.ts, which adapts that tool's snake_case response
 * onto this camelCase shape -- see mockRuns.ts's `loadPipelineRuns` for
 * the thin loader RunHistoryPanel actually calls. Note the tool's own
 * doc comment: only Researcher/Reviewer are currently driven by
 * start_pipeline (Milestone 1), so Synthesizer/Arbiter steps always
 * report 'pending' until Milestone 2 wires them in too.
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
