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
  /**
   * Discovery scope (Memory Agent v3 -- library/teams), replacing the
   * public/private binary. 'private': only via get_graph by exact name.
   * 'team': discoverable by list_graphs/search_graphs called with a
   * matching `team`. 'public': discoverable by everyone. Falls back to
   * 'public'/'private' (derived from `public`) on older servers that
   * don't send this field yet.
   */
  visibility?: 'private' | 'team' | 'public'
  /** The team namespace this graph is scoped to, when visibility === 'team'. */
  team?: string | null
  /**
   * Clone lineage (see clone_graph's copy_name + register_graph's
   * source_graph_name): the registry name this graph was forked from,
   * or undefined/null if it wasn't cloned (or was cloned from a bare
   * session id with no registered name).
   */
  source_graph_name?: string | null
  /**
   * Graph Lifecycle (first slice): one of 'draft', 'published',
   * 'active', 'stale', 'under_review', 'archived'. See
   * cks_mcp/tools/update_graph_lifecycle for the allowed-transition
   * map. Falls back to 'draft' (or 'published' when `public`) on
   * older servers that don't send this field yet.
   */
  lifecycle_state?: LifecycleState
}

/** Graph Lifecycle states, see `GraphRegistryEntry.lifecycle_state`. */
export type LifecycleState =
  | 'draft'
  | 'published'
  | 'active'
  | 'stale'
  | 'under_review'
  | 'archived'

/**
 * Ответ clone_graph (см. cks_mcp/tools/clone_graph/handler.py). session_id
 * пуст только если target_session_id уже содержал всё (version_id: null).
 */
export interface CloneGraphResult {
  session_id: string
  version_id: string | null
  source_session_id: string
  source_graph_name?: string
  imported_objects: number
  imported_relations: number
  registered_as?: string
  message?: string
}

/** Одна запись в compare_graphs.differences (см. cks_mcp/diffing.py::field_level_diff). */
export interface CompareGraphsDifference {
  id: string
  action: 'added' | 'deleted' | 'modified' | 'unchanged'
  type?: string
  name?: string
  changes?: Record<string, { from: unknown; to: unknown }>
}

/** Ответ compare_graphs (см. cks_mcp/tools/compare_graphs/handler.py). Read-only. */
export interface CompareGraphsResult {
  graph_a: string
  graph_b: string
  graph_a_session_id: string
  graph_b_session_id: string
  shared_object_count: number
  only_in_a_count: number
  only_in_b_count: number
  shared_object_ids: string[]
  only_in_a: string[]
  only_in_b: string[]
  differences: CompareGraphsDifference[]
}

/** Один конфликт в merge_graphs, когда merged=false. */
export interface MergeGraphsConflict {
  object_id: string
  target_diff: Record<string, unknown>
  source_diff: Record<string, unknown>
}

/** Ответ merge_graphs (см. cks_mcp/tools/merge_graphs/handler.py) -- две
 *  формы в одном объекте вместо discriminated union, т.к. бэкенд не всегда
 *  шлёт merged явно (см. error-ветки типа unverified_provenance). */
export interface MergeGraphsResult {
  merged: boolean
  message?: string
  session_id?: string
  version_id?: string
  graph_a_session_id?: string
  graph_b_session_id?: string
  object_count?: number
  dropped_relations?: string[]
  registered_as?: string
  conflicts?: MergeGraphsConflict[]
  error?: string
  details?: unknown
}

/** Ответ link_graphs (см. cks_mcp/tools/link_graphs/handler.py) при успехе. */
export interface LinkGraphsResult {
  linked: true
  relation_id: string
  graph_a_version: string
  graph_b_version: string
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
// ---------------------------------------------------------------------------
// explain_knowledge with object_id — "why is this object believed?"
// (cks-mcp ADR-001, cks-core src/cks/constraints/reasoning.py::explain_inference)
// ---------------------------------------------------------------------------

/** One InferenceStep once concluding an object, since revised away. */
export interface SupersededStepNode {
  step_id: string
  operator: string | null
  confidence: number | null
  justification: string | null
  superseded_by: string | null
}

/**
 * A premise cited by an InferenceStep. Either a nested sub-explanation
 * (the premise is itself the conclusion of other steps, or a base fact
 * with no inference at all), or `{ object_id, cites_step: true }` when
 * the premise names another InferenceStep directly (meta-reasoning
 * citation) rather than a conclusion.
 */
export type InferencePremiseNode =
  | InferenceExplanationNode
  | { object_id: string; cites_step: true }

/** One active InferenceStep node in the walk back to base facts. */
export interface InferenceStepNode {
  step_id: string
  operator: string | null
  confidence: number | null
  justification: string | null
  alternatives_considered: string[]
  premises: InferencePremiseNode[]
}

/**
 * Shape returned for `object_id` itself and for every nested premise
 * that isn't a direct step citation. `truncated` is only present on
 * nested premise nodes (`"max_depth" | "cycle"`), never on the
 * top-level result — see cks-core's explain_inference docstring.
 */
export interface InferenceExplanationNode {
  object_id: string
  exists?: boolean
  has_inference: boolean | null
  active_steps: InferenceStepNode[]
  superseded_steps: SupersededStepNode[]
  truncated?: 'max_depth' | 'cycle' | null
}

/** Top-level payload of explain_knowledge's `explanation` field when
 *  called with `object_id`. */
export type ExplainInferenceResult = InferenceExplanationNode & {
  exists: boolean
}

// ---------------------------------------------------------------------------
// arbitrate_inference_conflict / list_inference_conflicts (belief-revision
// actions surfaced from WhyThisBeliefPanel) — see cks-mcp
// tools/arbitrate_inference_conflict/{schema,handler}.py.
// ---------------------------------------------------------------------------

/** The caller's or auto_resolve's decision on a disputed conclusion. */
export interface ArbitrationDecision {
  winner_step_id: string
  reasoning: string | null
  runner_up_ids: string[]
  confidence_in_decision: number | null
  model_used?: string
}

/**
 * Single-conclusion, non-batch response shape (session_id/conclusion_id,
 * not conclusion_ids/results — see handler.py's single vs batch path).
 * 'active_steps' is the exact same per-step shape explain_knowledge
 * returns (both come from the same ExplainInferenceOperation), hence
 * reusing InferenceStepNode rather than a parallel type.
 */
export interface ArbitrateConflictResponse {
  session_id: string
  conclusion_id: string
  conflict: boolean
  /** Present when conflict === false (fewer than two active steps). */
  message?: string
  active_steps: InferenceStepNode[]
  policy?: string
  decision?: ArbitrationDecision
  decision_source?: 'caller' | 'auto_resolve'
  /** Present only when the request also had commit: true. */
  commit_result?: EvolveResult
}

/** One entry of a stale_premise_ids resolution ('results' in the
 *  handler's _resolve_stale_premises response). */
export interface StalePremiseFixItem {
  step_id: string
  /** Present when step_id wasn't found / wasn't an InferenceStep. */
  error?: string
  resolved?: boolean
  message?: string
  /** premise_id (stale, superseded) -> its current live successor. */
  fixes?: Record<string, string>
}

/** Response shape when the request used 'stale_premise_ids' instead of
 *  'conclusion_id' (mutually exclusive branch, see schema.py). */
export interface StalePremiseResolutionResponse {
  session_id: string
  results: StalePremiseFixItem[]
  /** Present only when the request also had commit: true. */
  commit_result?: EvolveResult
}

/** Business-level failure from arbitrate_inference_conflict (e.g.
 *  invalid_parameter, missing_decision, llm_output_parse_error) —
 *  same 200-with-'error'-field shape as EvolveError. */
export interface ArbitrateConflictError {
  error: string
  message?: string
}

export type ArbitrateInferenceConflictResult =
  | ArbitrateConflictResponse
  | StalePremiseResolutionResponse
  | ArbitrateConflictError

export function isArbitrateConflictError(
  result: ArbitrateInferenceConflictResult,
): result is ArbitrateConflictError {
  return 'error' in result
}

export function isStalePremiseResolution(
  result: ArbitrateInferenceConflictResult,
): result is StalePremiseResolutionResponse {
  return 'results' in result
}

/** One record from list_inference_conflicts's 'conflicts' array —
 *  a background InferenceStalenessSweeper finding no one has acted on
 *  yet. 'diagnostics' reuses EvolveDiagnostic's {code, severity,
 *  message, location} shape (same one evolve_knowledge/validate_knowledge
 *  already return). */
export interface InferenceConflictRecord {
  session_id: string
  version_id: string
  diagnostics: EvolveDiagnostic[]
  detected_at: string
  record_id: string
}

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
