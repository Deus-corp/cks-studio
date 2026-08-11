// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Единый источник цветов/иконок по CKS-типу объекта и по статусу пайплайна.
 *
 * Раньше эти таблицы были продублированы в components/graph/nodes/CksNode.tsx
 * и components/layout/SidePanel.tsx (см. STATUS_COLORS в обоих файлах) —
 * при добавлении нового статуса/типа их пришлось бы редактировать в двух
 * местах, и они бы неизбежно разошлись.
 */

/** Цвет по CKS-типу объекта. Покрывает как базовые типы Knowledge
 *  Structure (Definition, Claim, Concept, Fork, Resolution), так и типы,
 *  которые появляются в графах экосистемы (register_graph/evolve_knowledge
 *  поверх нескольких репозиториев): Component, Module, ADR, Tool, Agent,
 *  Interface, StorageBackend, Plugin, Sweeper, Task, Relation.
 *  Раньше вторая группа отсутствовала и всегда попадала в
 *  DEFAULT_NODE_TYPE_COLOR — граф экосистемы выглядел одноцветным. */
export const NODE_TYPE_COLORS: Record<string, string> = {
  // Базовые типы Knowledge Structure
  Definition: '#3b82f6',
  Claim: '#8b5cf6',
  Concept: '#10b981',
  Fork: '#f59e0b',
  Resolution: '#06b6d4',
  // Типы экосистемных графов (cks-ecosystem и подобные)
  Component: '#3b82f6',
  Module: '#22d3ee',
  ADR: '#f59e0b',
  Tool: '#a78bfa',
  Agent: '#ec4899',
  Interface: '#14b8a6',
  StorageBackend: '#84cc16',
  Plugin: '#f97316',
  Sweeper: '#eab308',
  Task: '#ef4444',
  Relation: '#64748b',
  // Типы, встречающиеся в графе экосистемы (cks-ecosystem) поверх типов
  // Reasoning Objects (ADR-001 cks-core) и pipeline-узлов cks-mcp: ранее
  // у них не было ни цвета, ни иконки, и они рендерились серым "?".
  ReasoningNode: '#a78bfa',
  Entity: '#3b82f6',
  Axiom: '#f472b6',
  Lemma: '#38bdf8',
  Theorem: '#fbbf24',
  Proof: '#34d399',
  InferenceStep: '#c084fc',
  VerificationRecord: '#06b6d4',
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
  Component: '🧩',
  Module: '📦',
  ADR: '📝',
  Tool: '🔧',
  Agent: '🤖',
  Interface: '🔌',
  StorageBackend: '🗄️',
  Plugin: '🧷',
  Sweeper: '🧹',
  Task: '☑️',
  Relation: '↔️',
  ReasoningNode: '🧠',
  Entity: '🏷️',
  Axiom: '⚛️',
  Lemma: '🔹',
  Theorem: '📐',
  Proof: '✅',
  InferenceStep: '🔗',
  VerificationRecord: '🛡️',
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
