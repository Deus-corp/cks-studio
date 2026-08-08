// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/** Идентификатор объекта в CKS */
export interface CksIdentity {
  id: string
  type: string
  name: string
}

/** Единичный объект знания */
export interface CksObject {
  identity: CksIdentity
  structure: Record<string, unknown>
}

/** Связь между объектами */
export interface CksRelation {
  identity: CksIdentity
  participants: string[]
  relation_type: string
}

/** Ответ инструмента query_subgraph (упрощённый) */
export interface SubgraphResult {
  nodes: CksObject[]
  edges: {
    source: string
    target: string
    relation_type: string
  }[]
}

export interface ForkVersionData {
  object_id: string
  origin_node: string
  created_at: string
  structure: Record<string, unknown>
}

/**
 * Запись в graph_registry (Memory Agent v1/v2), см.
 * cks_runtime/storage/sqlite_storage.py::_graph_row_to_dict.
 * tags — сырая comma-separated строка, как хранится в БД.
 */
export interface GraphRegistryEntry {
  name: string
  session_id: string
  description: string
  tags: string
  created_at: string
  updated_at: string
  public: boolean
}

/** Ответ check_graph_health, когда сессия доступна и посчитан скор. */
export interface GraphHealthResult {
  name: string
  session_id: string
  health_score: number
  metrics: Record<string, { score: number; [key: string]: unknown }>
  timestamp: string
}

/** Ответ check_graph_health, когда граф зарегистрирован, но сессия не загружена. */
export interface GraphHealthUnavailable {
  found: true
  name: string
  session_id: string
  error: 'session_not_available'
  message: string
}
