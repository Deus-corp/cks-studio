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

// ---------------------------------------------------------------------------
// Version diff (list_versions / explain_diff)
// ---------------------------------------------------------------------------

/** Запись в session.version_history, см. cks_mcp/tools/revert/handler.py::list_versions. */
export interface VersionEntry {
  version_id: string
  created_at: string
  transaction_id: string
  metadata: Record<string, unknown>
}

export interface ListVersionsResult {
  session_id: string
  versions: VersionEntry[]
}

/** Один элемент added_objects/removed_objects/modified_objects или их
 *  relation-аналогов в ответе explain_diff, см.
 *  cks_mcp/diffing.py::field_level_diff и explain_diff/handler.py::_classify.
 *
 *  - added: есть `structure` (полный снапшот нового объекта), нет `changes`.
 *  - deleted: нет ни `structure`, ни `changes` — только id/type/name.
 *  - modified: есть `changes` ({field: {from, to}}), нет `structure`.
 */
export interface DiffEntry {
  id: string
  action: 'added' | 'deleted' | 'modified' | 'unchanged'
  type: string
  name: string
  structure?: Record<string, unknown>
  changes?: Record<string, { from: unknown; to: unknown }>
}

export interface RenamedObjectEntry {
  id: string
  new_name: string
}

export interface InferenceStepDiffEntry {
  id: string
  premises: string[]
  conclusion: unknown
  operator: unknown
  confidence: number | null
  justification: unknown
}

/** Ответ explain_diff, см. cks_mcp/tools/explain_diff/handler.py. */
export interface ExplainDiffResult {
  session_id: string
  base_version_id: string
  summary: string
  details: {
    added_objects: DiffEntry[]
    removed_objects: DiffEntry[]
    modified_objects: DiffEntry[]
    added_relations: DiffEntry[]
    removed_relations: DiffEntry[]
    modified_relations: DiffEntry[]
    relinked_relations: DiffEntry[]
    renamed_objects: RenamedObjectEntry[]
    added_inference_steps: InferenceStepDiffEntry[]
  }
}
