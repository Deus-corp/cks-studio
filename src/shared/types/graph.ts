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

// ---------------------------------------------------------------------------
// evolve_knowledge — see cks-mcp src/cks_mcp/tools/evolve/schema.py
// ---------------------------------------------------------------------------

/**
 * Операторы эволюции, поддерживаемые evolve_knowledge. Оставлены только
 * 'add_object' и 'add_relation' — это единственные операторы, которые
 * нужны create-форме студии (студия сейчас read-only, remove/update/rename
 * не используются UI). Остальные типы из схемы бэкенда сюда осознанно не
 * включены, чтобы не создавать видимость поддержки того, чего нет в UI.
 */
export type EvolveOperation =
  | {
      type: 'add_object'
      identity: CksIdentity
      structure?: Record<string, unknown>
    }
  | {
      type: 'add_relation'
      identity: CksIdentity
      participants: [string, string]
      relation_type: string
      structure?: Record<string, unknown>
    }

/** Один diagnostic из validate_knowledge / evolve_knowledge, см.
 *  cks_mcp/tools/evolve/handler.py::non_blocking_diagnostics и
 *  validation_failed-ветку. */
export interface EvolveDiagnostic {
  code: string
  severity: 'error' | 'warning' | 'information'
  message: string
  location?: string
}

/** Успешный ответ evolve_knowledge (см. handler.py, конец функции).
 *  'diagnostics' здесь — это НЕ blocking-ошибки: коммит уже прошёл,
 *  это warning/info-уровня находки (например
 *  CKS-EXT-INFERENCE-CONFIDENCE-CONFLICT), которые стоит показать
 *  пользователю, но не как fail-состояние формы. */
export interface EvolveSuccess {
  evolved: true
  serialized: string
  operations_applied: number
  version_id: string
  session_id: string
  cascade_removed_relations?: string[]
  extensions_applied?: string[]
  diagnostics?: EvolveDiagnostic[]
}

/** Ошибка evolve_knowledge. Приходит как обычный 200 с JSON-RPC-уровня
 *  успехом, но с полем 'error' внутри распарсенного tool result — см.
 *  примечание в services/mcpTools.ts::evolveKnowledge про то, почему
 *  это нельзя различить через try/catch вокруг callTool. */
export interface EvolveError {
  error: string
  message?: string
  /** Только при error === 'validation_failed'. */
  diagnostics?: EvolveDiagnostic[]
  /** Только при error === 'validation_failed' для provenance-отказа
   *  (blocking-diagnostics из provenance.verify_structure_provenance). */
  details?: EvolveDiagnostic[]
}

export type EvolveResult = EvolveSuccess | EvolveError

export function isEvolveError(result: EvolveResult): result is EvolveError {
  return 'error' in result
}
