// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Единый источник цветов/иконок по CKS-типу объекта и по статусу пайплайна.
 *
 * Раньше эти таблицы были продублированы в components/graph/nodes/CksNode.tsx
 * и components/layout/SidePanel.tsx (см. STATUS_COLORS в обоих файлах) —
 * при добавлении нового статуса/типа их пришлось бы редактировать в двух
 * местах, и они бы неизбежно разошлись.
 */

/** Цвет по CKS-типу объекта (Definition, Claim, Concept, Fork, Resolution, ...). */
export const NODE_TYPE_COLORS: Record<string, string> = {
  Definition: '#3b82f6',
  Claim: '#8b5cf6',
  Concept: '#10b981',
  Fork: '#f59e0b',
  Resolution: '#06b6d4',
}

/** Цвет для CKS-типов, которых нет в NODE_TYPE_COLORS. */
export const DEFAULT_NODE_TYPE_COLOR = '#6b7280'

/** Эмодзи-иконка по CKS-типу объекта, для узлов графа. */
export const NODE_TYPE_ICONS: Record<string, string> = {
  Definition: '📖',
  Claim: '💬',
  Concept: '💡',
  Fork: '⑂',
  Resolution: '✓',
}

export const DEFAULT_NODE_TYPE_ICON = '?'

/** Цвет по значению structure.current_status пайплайна (ADR-007). */
export const PIPELINE_STATUS_COLORS: Record<string, string> = {
  awaiting_research: '#6b7280',
  awaiting_review: '#3b82f6',
  needs_research: '#ef4444',
  resolved: '#10b981',
}

export const DEFAULT_PIPELINE_STATUS_COLOR = '#6b7280'

export function nodeTypeColor(cksType: string | undefined): string {
  if (!cksType) return DEFAULT_NODE_TYPE_COLOR
  return NODE_TYPE_COLORS[cksType] ?? DEFAULT_NODE_TYPE_COLOR
}

export function nodeTypeIcon(cksType: string | undefined): string {
  if (!cksType) return DEFAULT_NODE_TYPE_ICON
  return NODE_TYPE_ICONS[cksType] ?? DEFAULT_NODE_TYPE_ICON
}

export function pipelineStatusColor(status: string | undefined): string {
  if (!status) return DEFAULT_PIPELINE_STATUS_COLOR
  return PIPELINE_STATUS_COLORS[status] ?? DEFAULT_PIPELINE_STATUS_COLOR
}
