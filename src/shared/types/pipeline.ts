// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Соответствует cks_mcp/pipeline/schema.py (ADR-007).
 *
 * current_status/transition_log — это не отдельная сущность в MCP, а поля
 * прямо внутри structure любого объекта, который проходит через пайплайн
 * Researcher -> Reviewer -> (Synthesizer -> Arbiter, Milestone 2, ещё не
 * реализовано). Studio читает их через уже существующий getFullGraph /
 * query_subgraph — отдельный backend-инструмент не нужен.
 */
export const PIPELINE_STATUSES = [
  'awaiting_research',
  'awaiting_review',
  'awaiting_synthesis',
  'awaiting_arbitration',
  'needs_research',
  'resolved',
] as const

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]

/** Статусы, которые реально проставляются Milestone 1 (Researcher + Reviewer). */
export const ACTIVE_PIPELINE_STATUSES: PipelineStatus[] = [
  'awaiting_research',
  'awaiting_review',
  'needs_research',
  'resolved',
]

export interface TransitionLogEntry {
  timestamp: string
  agent: string
  action: string
  transitioned_to: string
  reasoning_node_id?: string | null
}

/** Объект с pipeline-полями внутри structure (подмножество CksObject). */
export interface PipelineObject {
  id: string
  name: string
  type: string
  current_status: PipelineStatus | null
  transition_log: TransitionLogEntry[]
}
