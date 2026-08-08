// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { PipelineStatus } from '@/shared/types/pipeline'

/** Цвета для колонок/бэйджей Pipeline Monitor, по current_status (ADR-007). */
export const STATUS_COLORS: Record<PipelineStatus, string> = {
  awaiting_research: '#6b7280',
  awaiting_review: '#3b82f6',
  awaiting_synthesis: '#8b5cf6',
  awaiting_arbitration: '#f59e0b',
  needs_research: '#ef4444',
  resolved: '#10b981',
}

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  awaiting_research: 'Awaiting Research',
  awaiting_review: 'Awaiting Review',
  awaiting_synthesis: 'Awaiting Synthesis',
  awaiting_arbitration: 'Awaiting Arbitration',
  needs_research: 'Needs Research',
  resolved: 'Resolved',
}
