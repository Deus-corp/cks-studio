import type {
  PipelineRun,
  PipelineRunStatus,
  PipelineStepName,
  PipelineStepStatus,
} from '@/features/pipeline-runs/types'
import type {
  ArbitrateInferenceConflictResult,
  CksObject,
  CloneGraphResult,
  CompareGraphsResult,
  EvolveOperation,
  EvolveResult,
  ExplainDiffResult,
  ExplainInferenceResult,
  GraphHealthResult,
  GraphHealthUnavailable,
  GraphRegistryEntry,
  InferenceConflictRecord,
  LifecycleState,
  LinkGraphsResult,
  ListVersionsResult,
  MergeGraphsResult,
  SubgraphResult,
} from '@/shared/types/graph'
import { callTool } from './mcpClient'

/** Канонический узел, который в compact_mode отдаёт query_subgraph_tool
 *  (см. cks-mcp src/cks_mcp/tools/query_subgraph/handler.py) — та же форма
 *  {identity: {id, type, name}, structure}, что и в serialize_knowledge. */
type CompactSubgraphNode = CksObject

/** Плоская форма ребра в compact_mode: source/target/type (НЕ relation_type). */
interface CompactSubgraphEdge {
  source: string | null
  target: string | null
  type: string
}

interface CompactQuerySubgraphResponse {
  subgraph?: {
    nodes?: CompactSubgraphNode[]
    edges?: CompactSubgraphEdge[]
  }
}

/**
 * Адаптер под реальный формат ответа query_subgraph_tool (см. cks-mcp
 * src/cks_mcp/tools/query_subgraph/handler.py, compact_mode-ветка):
 *
 * - узлы/рёбра лежат ВНУТРИ result.subgraph, не на верхнем уровне ответа;
 * - узел уже в каноническом виде {identity: {id, type, name}, structure},
 *   как и в serialize_knowledge (с 2026-08-08 backend больше не отдаёт
 *   плоский {id, type, name, props} — см. обсуждение "query_subgraph без
 *   seed_ids");
 * - ребро использует ключ `type`, а не `relation_type` — это по-прежнему
 *   нормализуем.
 */
export function normalizeCompactSubgraphResponse(
  raw: Record<string, unknown>,
): SubgraphResult {
  const response = raw as CompactQuerySubgraphResponse
  const rawNodes = response.subgraph?.nodes ?? []
  const rawEdges = response.subgraph?.edges ?? []

  const nodes: CksObject[] = rawNodes.map((n) => ({
    identity: {
      id: n.identity.id,
      type: n.identity.type,
      name: n.identity.name,
    },
    structure: n.structure ?? {},
  }))

  const edges: SubgraphResult['edges'] = rawEdges
    .filter(
      (e): e is CompactSubgraphEdge & { source: string; target: string } =>
        Boolean(e.source) && Boolean(e.target),
    )
    .map((e) => ({
      source: e.source,
      target: e.target,
      relation_type: e.type,
    }))

  return { nodes, edges }
}

export async function querySubgraph(
  sessionId: string,
  seedIds: string[],
  depth = 1,
): Promise<SubgraphResult> {
  const result = await callTool('query_subgraph', {
    session_id: sessionId,
    seed_ids: seedIds,
    depth,
    compact_mode: true,
  })
  return normalizeCompactSubgraphResponse(result)
}

/** Получает полную Knowledge Structure сессии через serialize_knowledge */
export async function getFullGraph(sessionId: string): Promise<SubgraphResult> {
  const result = await callTool('serialize_knowledge', {
    session_id: sessionId,
  })
  if (result.serialized) {
    const structure = JSON.parse(result.serialized as string) as {
      objects: CksObject[]
    }
    const allObjects: CksObject[] = structure.objects || []
    const nodes: CksObject[] = allObjects.filter(
      (obj) => obj.identity?.type !== 'Relation',
    )
    const relations: CksObject[] = allObjects.filter(
      (obj) => obj.identity?.type === 'Relation',
    )
    const edges: SubgraphResult['edges'] = relations.map((rel) => {
      const participants =
        (rel.structure?.participants as string[] | undefined) ?? []
      const relationType =
        (rel.structure?.relation_type as string | undefined) ??
        rel.identity?.name ??
        'unknown'
      return {
        source: participants[0] || '',
        target: participants[1] || '',
        relation_type: relationType,
      }
    })
    return { nodes, edges }
  }
  return { nodes: [], edges: [] }
}

/**
 * Fetches a session's canonical JSON representation as a raw string via
 * serialize_knowledge, for download (see graphExport.downloadGraphAsJson)
 * -- the same tool/shape getFullGraph above parses into nodes/edges, but
 * this returns the untouched string so a round-trip export/import is
 * byte-for-byte what the server produced, not a re-serialization of our
 * own parsed-and-reshaped copy.
 */
export async function getFullGraphAsJson(sessionId: string): Promise<string> {
  const result = await callTool('serialize_knowledge', {
    session_id: sessionId,
  })
  return (result.serialized as string | undefined) ?? '{"objects": []}'
}

/** Error shape returned by validate_knowledge when json_data doesn't
 *  parse, or the resulting structure fails validation. */
export interface ImportGraphError {
  error: string
  message: string
}

/**
 * Imports a previously-exported (or hand-written) canonical JSON graph
 * via validate_knowledge -- the same tool ai_chat's own
 * SESSION_CREATING_TOOLS path already relies on (see useAiChat.ts) to
 * mint a brand-new session from json_data. Used by the logo menu's
 * "Import graph" item (App.tsx) to load a .json file exported via
 * getFullGraphAsJson/downloadGraphAsJson above.
 */
export async function importGraphFromJson(
  jsonData: string,
): Promise<{ session_id: string } | ImportGraphError> {
  const result = await callTool('validate_knowledge', {
    json_data: jsonData,
  })
  return result as unknown as { session_id: string } | ImportGraphError
}

/**
 * Creates a brand-new, empty session via validate_knowledge with an
 * empty `objects` array -- the same tool importGraphFromJson above
 * uses, just with a canned empty document instead of a user-supplied
 * one. Used by the logo menu's "Create graph" item (LogoMenu.tsx) so
 * clicking it actually gets a usable session_id back (previously it
 * just cleared sessionId client-side, leaving no session for Quick AI
 * or the create-node/relation forms to target until the user typed one
 * in by hand).
 */
export async function createEmptySession(): Promise<
  { session_id: string } | ImportGraphError
> {
  const result = await callTool('validate_knowledge', {
    json_data: JSON.stringify({ objects: [] }),
  })
  return result as unknown as { session_id: string } | ImportGraphError
}

// ---------------------------------------------------------------------------
// Graph Gallery (Memory Agent v1/v2): list_graphs / search_graphs / register_graph
// ---------------------------------------------------------------------------

export async function listGraphs(
  options: { tag?: string; publicOnly?: boolean; team?: string } = {},
): Promise<GraphRegistryEntry[]> {
  const result = await callTool('list_graphs', {
    ...(options.tag ? { tag: options.tag } : {}),
    public_only: options.publicOnly ?? false,
    ...(options.team ? { team: options.team } : {}),
  })
  return (result.graphs as GraphRegistryEntry[] | undefined) ?? []
}

export async function searchGraphs(
  query: string,
  options: { tag?: string; publicOnly?: boolean; team?: string } = {},
): Promise<GraphRegistryEntry[]> {
  const result = await callTool('search_graphs', {
    query,
    ...(options.tag ? { tag: options.tag } : {}),
    public_only: options.publicOnly ?? false,
    ...(options.team ? { team: options.team } : {}),
  })
  return (result.graphs as GraphRegistryEntry[] | undefined) ?? []
}

export async function registerGraph(params: {
  name: string
  sessionId: string
  description?: string
  tags?: string
  isPublic?: boolean
  visibility?: 'private' | 'team' | 'public'
  team?: string
}): Promise<{
  registered: boolean
  name: string
  public: boolean
  visibility?: string
  team?: string | null
}> {
  const result = await callTool('register_graph', {
    name: params.name,
    session_id: params.sessionId,
    description: params.description ?? '',
    tags: params.tags ?? '',
    public: params.isPublic ?? false,
    ...(params.visibility ? { visibility: params.visibility } : {}),
    ...(params.team ? { team: params.team } : {}),
  })
  return result as unknown as {
    registered: boolean
    name: string
    public: boolean
    visibility?: string
    team?: string | null
  }
}

/** Success shape returned by unregister_graph. */
export interface UnregisterGraphResult {
  unregistered: true
  name: string
}

/** Error shape returned when no graph is registered under that name. */
export interface UnregisterGraphError {
  error: string
  message: string
}

/**
 * Removes a graph from the registry (Gallery) via the unregister_graph
 * MCP tool. Only removes the name -> session_id mapping -- the
 * underlying session and its Knowledge Structure are left untouched
 * and remain addressable by session id (e.g. via cloneGraph).
 */
export async function unregisterGraph(params: {
  name: string
}): Promise<UnregisterGraphResult | UnregisterGraphError> {
  const result = await callTool('unregister_graph', {
    name: params.name,
  })
  return result as unknown as UnregisterGraphResult | UnregisterGraphError
}

/** Success shape returned by update_graph_lifecycle on a real transition. */
export interface UpdateGraphLifecycleResult {
  updated: true
  name: string
  previous_state: LifecycleState
  new_state: LifecycleState
}

/**
 * Non-error, no-op shape: the graph was already in the requested
 * state, so nothing changed.
 */
export interface UpdateGraphLifecycleNoop {
  updated: false
  reason: string
  name: string
  previous_state: LifecycleState
  new_state: LifecycleState
}

/**
 * Error shape returned when the requested transition isn't in the
 * allowed-transition map (see cks_mcp/tools/update_graph_lifecycle/handler.py).
 */
export interface UpdateGraphLifecycleError {
  error: string
  message: string
  name: string
  previous_state?: LifecycleState
  requested_state?: LifecycleState
  allowed?: LifecycleState[]
}

/**
 * Transitions a registered graph's lifecycle_state via the
 * update_graph_lifecycle MCP tool. Only registered graphs have a
 * lifecycle state -- calling this for an unregistered name returns
 * the 'graph_not_found' error shape.
 */
export async function updateGraphLifecycle(params: {
  name: string
  state: LifecycleState
}): Promise<
  | UpdateGraphLifecycleResult
  | UpdateGraphLifecycleNoop
  | UpdateGraphLifecycleError
> {
  const result = await callTool('update_graph_lifecycle', {
    name: params.name,
    state: params.state,
  })
  return result as unknown as
    | UpdateGraphLifecycleResult
    | UpdateGraphLifecycleNoop
    | UpdateGraphLifecycleError
}

/**
 * Renders a session's Knowledge Structure (or subgraph) as a Mermaid
 * diagram via visualize_graph (see cks_mcp/tools/visualize_graph/handler.py,
 * mode='structure'). Used for the gallery's card preview -- a lightweight
 * peek at a graph's shape without fully opening it in the canvas.
 */
export async function visualizeGraph(params: {
  sessionId: string
  seedIds?: string[]
  depth?: number
  maxObjects?: number
}): Promise<{
  mermaid: string
  total_found_nodes: number
  returned_nodes: number
  is_truncated: boolean
}> {
  const result = await callTool('visualize_graph', {
    session_id: params.sessionId,
    mode: 'structure',
    ...(params.seedIds ? { seed_ids: params.seedIds } : {}),
    depth: params.depth ?? 1,
    max_objects: params.maxObjects ?? 12,
  })
  return result as unknown as {
    mermaid: string
    total_found_nodes: number
    returned_nodes: number
    is_truncated: boolean
  }
}

export async function checkGraphHealth(
  name: string,
): Promise<GraphHealthResult | GraphHealthUnavailable> {
  const result = await callTool('check_graph_health', { name })
  return result as unknown as GraphHealthResult | GraphHealthUnavailable
}

/**
 * Клонирует зарегистрированный (по имени) граф в новую сессию через
 * clone_graph (см. cks_mcp/tools/clone_graph/handler.py). Источник
 * никогда не модифицируется. targetSessionId/copyName пробрасываются
 * как есть, если понадобится импорт в существующую сессию или
 * регистрация клона под новым именем -- Gallery сегодня использует
 * только graphName, создавая новую сессию каждый раз.
 *
 * Как и explainKnowledge/evolveKnowledge, бизнес-уровневые ошибки
 * (неизвестный graph_name, отсутствующая source_session_id и т.д.)
 * приходят как обычный успешный tool-результат вида
 * `{ error: string, message?: string }`, а не как JSON-RPC ошибка —
 * здесь мы их перебрасываем как Error, чтобы вызывающий код (кнопка
 * Clone в Gallery) мог использовать один путь обработки ошибок.
 */
export async function cloneGraph(params: {
  graphName?: string
  sourceSessionId?: string
  targetSessionId?: string
  copyName?: string
}): Promise<CloneGraphResult> {
  const result = await callTool('clone_graph', {
    ...(params.graphName ? { graph_name: params.graphName } : {}),
    ...(params.sourceSessionId
      ? { source_session_id: params.sourceSessionId }
      : {}),
    ...(params.targetSessionId
      ? { target_session_id: params.targetSessionId }
      : {}),
    ...(params.copyName ? { copy_name: params.copyName } : {}),
  })
  if (typeof (result as { error?: unknown }).error === 'string') {
    throw new Error(
      (result as { error: string; message?: string }).message ??
        (result as { error: string }).error,
    )
  }
  return result as unknown as CloneGraphResult
}

// ---------------------------------------------------------------------------
// Cross-graph analysis: compare_graphs / merge_graphs / link_graphs
// ---------------------------------------------------------------------------

interface GraphSideParams {
  graphName?: string
  sessionId?: string
}

function graphSideArgs(
  side: GraphSideParams,
  nameField: string,
  sessionField: string,
): Record<string, string> {
  return {
    ...(side.graphName ? { [nameField]: side.graphName } : {}),
    ...(side.sessionId ? { [sessionField]: side.sessionId } : {}),
  }
}

/**
 * Read-only diff of two graphs via compare_graphs (see
 * cks_mcp/tools/compare_graphs/handler.py). Never modifies either side.
 * Each side is identified by registry name and/or session id -- session
 * id takes precedence server-side when both are given for the same side.
 */
export async function compareGraphs(params: {
  graphA: GraphSideParams
  graphB: GraphSideParams
  includeRelations?: boolean
}): Promise<CompareGraphsResult> {
  const result = await callTool('compare_graphs', {
    ...graphSideArgs(params.graphA, 'graph_a_name', 'graph_a_session_id'),
    ...graphSideArgs(params.graphB, 'graph_b_name', 'graph_b_session_id'),
    include_relations: params.includeRelations ?? true,
  })
  return result as unknown as CompareGraphsResult
}

/**
 * Three-way merges two graphs into a brand-new session via merge_graphs
 * (see cks_mcp/tools/merge_graphs/handler.py). Neither source session is
 * ever modified. On conflict the result comes back as a normal
 * `{merged: false, conflicts: [...]}` result rather than a thrown error --
 * unlike cloneGraph/explainKnowledge above, callers here genuinely need to
 * branch on `merged` (to show a conflict list with a retry path), so this
 * does NOT re-throw on merged:false. It still throws on transport-level
 * failures and on other business errors (e.g. `error: "invalid_resolutions"`)
 * that have no useful in-place UI beyond an error message.
 */
export async function mergeGraphs(params: {
  graphA: GraphSideParams
  graphB: GraphSideParams
  base?: GraphSideParams
  resolutions?: Record<string, unknown>
  registerAs?: string
}): Promise<MergeGraphsResult> {
  const result = await callTool('merge_graphs', {
    ...graphSideArgs(params.graphA, 'graph_a_name', 'graph_a_session_id'),
    ...graphSideArgs(params.graphB, 'graph_b_name', 'graph_b_session_id'),
    ...(params.base
      ? graphSideArgs(params.base, 'base_graph_name', 'base_session_id')
      : {}),
    ...(params.resolutions ? { resolutions: params.resolutions } : {}),
    ...(params.registerAs ? { register_as: params.registerAs } : {}),
  })
  const typed = result as unknown as MergeGraphsResult
  if (typed.merged !== true && typed.merged !== false) {
    // error / unverified_provenance / invalid_resolutions etc. -- no
    // conflicts array to render, so surface it the same way cloneGraph
    // does for its business-level errors.
    throw new Error(typed.message ?? typed.error ?? 'merge_graphs failed')
  }
  return typed
}

/**
 * Creates a cross-graph relation between an object in graph A and an
 * object in graph B via link_graphs (see
 * cks_mcp/tools/link_graphs/handler.py). Written to BOTH source sessions.
 * Business-level failures (object_not_found, relation_already_exists,
 * duplicate_object_conflict, or a partial_failure after graph A's side
 * already committed) come back as `{error, message}` rather than a
 * thrown error -- re-thrown here for a single error path, same as
 * cloneGraph/explainKnowledge.
 */
export async function linkGraphs(params: {
  graphA: GraphSideParams
  graphB: GraphSideParams
  objectAId: string
  objectBId: string
  relationType: string
  relationName?: string
}): Promise<LinkGraphsResult> {
  const result = await callTool('link_graphs', {
    ...graphSideArgs(params.graphA, 'graph_a_name', 'graph_a_session_id'),
    ...graphSideArgs(params.graphB, 'graph_b_name', 'graph_b_session_id'),
    object_a_id: params.objectAId,
    object_b_id: params.objectBId,
    relation_type: params.relationType,
    ...(params.relationName ? { relation_name: params.relationName } : {}),
  })
  if (typeof (result as { error?: unknown }).error === 'string') {
    throw new Error(
      (result as { error: string; message?: string }).message ??
        (result as { error: string }).error,
    )
  }
  return result as unknown as LinkGraphsResult
}

// ---------------------------------------------------------------------------
// Version diff: list_versions / explain_diff
// ---------------------------------------------------------------------------

export async function listVersions(
  sessionId: string,
): Promise<ListVersionsResult> {
  const result = await callTool('list_versions', { session_id: sessionId })
  return result as unknown as ListVersionsResult
}

/**
 * explain_diff сравнивает ТЕКУЩЕЕ состояние сессии с версией
 * targetVersionId (см. cks_mcp/tools/explain_diff/handler.py) — то есть
 * это всегда "что изменилось с версии X до сейчас", а не диапазон между
 * двумя произвольными версиями. Для сравнения двух конкретных прошлых
 * версий пришлось бы сначала revert_version в одну из них — эта функция
 * такого не делает.
 */
export async function explainDiff(
  sessionId: string,
  targetVersionId: string,
): Promise<ExplainDiffResult> {
  const result = await callTool('explain_diff', {
    session_id: sessionId,
    target_version_id: targetVersionId,
  })
  // callTool's return type is a loosely-typed Record<string, unknown> --
  // an `{error: ...}` business-error result (session_not_found,
  // missing_parameter, a failed version reconstruction/diff -- see
  // explain_diff's handler) has no `details` field at all, and
  // VersionDiff.tsx checks for `.error` itself before touching
  // `.details`, so pass those through untouched here. On a genuine
  // success shape, though, still guard each `details` array against
  // being missing -- e.g. an older/newer backend build, a transport
  // hiccup that returns a partial cached body, or a demo-mode mock
  // that doesn't happen to fill in every field -- so
  // `diff.details.added_objects.length` etc. can never throw
  // `Cannot read properties of undefined`.
  const raw = result as Partial<ExplainDiffResult> & { error?: string }
  if (raw.error) return raw as unknown as ExplainDiffResult
  const details = raw.details ?? ({} as Partial<ExplainDiffResult['details']>)
  return {
    session_id: raw.session_id ?? sessionId,
    base_version_id: raw.base_version_id ?? targetVersionId,
    summary: raw.summary ?? '',
    details: {
      added_objects: details.added_objects ?? [],
      removed_objects: details.removed_objects ?? [],
      modified_objects: details.modified_objects ?? [],
      added_relations: details.added_relations ?? [],
      removed_relations: details.removed_relations ?? [],
      modified_relations: details.modified_relations ?? [],
      relinked_relations: details.relinked_relations ?? [],
      renamed_objects: details.renamed_objects ?? [],
      added_inference_steps: details.added_inference_steps ?? [],
    },
  }
}

// ---------------------------------------------------------------------------
// explain_knowledge with object_id — "Why this belief?" panel (Graph page)
// ---------------------------------------------------------------------------

/**
 * Explains why `objectId` is currently believed within `sessionId`,
 * walking its active InferenceStep chain(s) back to base facts (see
 * cks-mcp's explain_knowledge tool / cks-core's explain_inference).
 *
 * Like evolveKnowledge, explain_knowledge's own business-level failures
 * (no attached Core, Core doesn't implement explain_inference, unknown
 * object_id, etc.) come back as a normal successful tool result shaped
 * `{ error: string }` rather than a thrown error (see cks-mcp handler.py
 * -- `internal_error(...)`). We re-throw here so callers (useExplainInference)
 * can use one error path for both that and real network/transport
 * failures, matching how the rest of this module's read-only helpers
 * (e.g. explainDiff) are consumed.
 */
export async function explainKnowledge(
  sessionId: string,
  objectId: string,
): Promise<ExplainInferenceResult> {
  const result = await callTool('explain_knowledge', {
    // json_data формально required в схеме тула, но handler.py читает его
    // только когда session_id не передан (та же ветка, что и у
    // evolveKnowledge выше) — пустая строка тут ничего не парсит.
    json_data: '',
    session_id: sessionId,
    object_id: objectId,
  })
  if (typeof (result as { error?: unknown }).error === 'string') {
    throw new Error(
      (result as { error: string; message?: string }).message ??
        (result as { error: string }).error,
    )
  }
  return (result as { explanation: ExplainInferenceResult }).explanation
}

// ---------------------------------------------------------------------------
// arbitrate_inference_conflict / list_inference_conflicts — belief-revision
// actions from WhyThisBeliefPanel (resolve a confidence conflict between
// active InferenceSteps, or repair a stale premise citation).
// ---------------------------------------------------------------------------

interface ResolveConflictParams {
  sessionId: string
  conclusionId: string
  winnerId?: string
  reasoning?: string
  autoResolve?: boolean
  commit?: boolean
}

interface RepairStalePremiseParams {
  sessionId: string
  stalePremiseIds: string[]
  commit?: boolean
}

/**
 * Wraps arbitrate_inference_conflict's two mutually-exclusive request
 * shapes (see cks-mcp tools/arbitrate_inference_conflict/schema.py):
 * 'conclusionId' resolves an InferenceConfidenceConflict, while
 * 'stalePremiseIds' resolves CKS-EXT-STALE-PREMISE findings instead --
 * one wrapper, one tool, matching the backend's own single endpoint.
 *
 * Like evolveKnowledge above, a business-level failure (invalid_parameter,
 * missing_decision, ...) comes back as a normal 200 with an 'error' field
 * rather than a thrown exception -- callers use isArbitrateConflictError
 * to tell it apart from a real result. try/catch here is for transport
 * failures only.
 */
export async function arbitrateInferenceConflict(
  params: ResolveConflictParams | RepairStalePremiseParams,
): Promise<ArbitrateInferenceConflictResult> {
  const body: Record<string, unknown> = {
    session_id: params.sessionId,
    commit: params.commit ?? false,
  }
  if ('stalePremiseIds' in params) {
    body.stale_premise_ids = params.stalePremiseIds
  } else {
    body.conclusion_id = params.conclusionId
    if (params.winnerId) body.winner_id = params.winnerId
    if (params.reasoning) body.reasoning = params.reasoning
    if (params.autoResolve) body.auto_resolve = params.autoResolve
  }
  const result = await callTool('arbitrate_inference_conflict', body)
  return result as unknown as ArbitrateInferenceConflictResult
}

/**
 * Peek (non-destructive by default here -- see 'peek' param) at
 * InferenceStalenessSweeper findings via list_inference_conflicts.
 * WhyThisBeliefPanel always calls this with peek: true: it's reading
 * findings to decide whether to show a "stale premise" warning on a
 * step, not claiming them for resolution, and draining someone else's
 * (e.g. a Critic agent's) queued finding just because a user opened
 * an inspector panel would be a surprising side effect.
 */
export async function listInferenceConflicts(
  params: { sessionId?: string; peek?: boolean } = {},
): Promise<{ conflicts: InferenceConflictRecord[]; count: number }> {
  const result = await callTool('list_inference_conflicts', {
    ...(params.sessionId ? { session_id: params.sessionId } : {}),
    peek: params.peek ?? false,
  })
  return result as unknown as {
    conflicts: InferenceConflictRecord[]
    count: number
  }
}

// ---------------------------------------------------------------------------
// evolve_knowledge — первая write-операция студии (add_object / add_relation)
// ---------------------------------------------------------------------------

/**
 * Вызывает evolve_knowledge с одной или несколькими операциями против
 * существующей сессии.
 *
 * ВАЖНО про обработку ошибок: evolve_knowledge не сигнализирует отказ
 * (например validation_failed) через JSON-RPC error / HTTP-статус — это
 * обычный успешный tools/call, просто распарсенный result содержит поле
 * 'error' (см. cks_mcp/tools/evolve/handler.py). callTool() в mcpClient.ts
 * бросает исключение только на транспортном уровне (не-2xx, JSON-RPC
 * error-объект) и иначе возвращает распарсенный content как есть — значит
 * try/catch вокруг callTool НЕ поймает validation_failed, invalid_json,
 * unknown_extension и т.п. Поэтому здесь мы не бросаем исключение на
 * бизнес-уровне ошибки, а возвращаем discriminated union (EvolveResult) и
 * оставляем try/catch вызывающему коду только для сетевых сбоев.
 */
/**
 * Статус одного in-process sweeper'а рантайма (см. cks-mcp
 * src/cks_mcp/tools/list_agents/schema.py и agent_status/schema.py).
 *
 * ВАЖНО: покрывает только in-process sweeper'ы (ContradictionSweeper,
 * InferenceStalenessSweeper и т.д.), НЕ standalone-процессы (Critic Agent,
 * Enrichment Agent, Fork Resolution Agent, Pipeline Agent) — те пока не
 * наблюдаемы ни через один MCP-тул (см. AGENT_VISIBILITY.md, v2).
 */
export interface AgentStatus {
  agent_id: string
  kind: 'sweeper'
  running: boolean
  interval_seconds: number
  last_run_at: string | null
  last_run_duration_ms: number | null
  last_result_count: number | null
  last_error: string | null
}

/** Ответ agent_status, когда agent_id не совпал ни с одним включённым
 *  sweeper'ом — не ошибка (см. схему тула: неизвестный id и отключённый
 *  через Runtime-конфиг sweeper неотличимы друг от друга). */
export interface AgentNotFound {
  agent_id: string
  found: false
}

/** list_agents не принимает session_id (в отличие от большинства тулов
 *  студии) — данные не привязаны к конкретной сессии/графу. */
export async function listAgents(): Promise<{ agents: AgentStatus[] }> {
  const result = await callTool('list_agents', {})
  return { agents: (result.agents as AgentStatus[]) ?? [] }
}

export async function getAgentStatus(
  agentId: string,
): Promise<AgentStatus | AgentNotFound> {
  const result = await callTool('agent_status', { agent_id: agentId })
  return result as unknown as AgentStatus | AgentNotFound
}

/**
 * Запускает sweeper через start_agent и персистит desired_running=True на
 * ЭТОЙ ноде (cks-runtime ADR-015). В multi-node деплое НЕ распространяется
 * на другие ноды (в отличие от stopAgent) — см. описание тула в cks-mcp
 * (ADR-015 §3: старт/стоп намеренно асимметричны). {found: false} — не
 * ошибка, а неизвестный/отключённый через конфиг Runtime agent_id.
 */
export async function startAgent(
  agentId: string,
): Promise<AgentStatus | AgentNotFound> {
  const result = await callTool('start_agent', { agent_id: agentId })
  return result as unknown as AgentStatus | AgentNotFound
}

/**
 * Останавливает sweeper через stop_agent и персистит desired_running=False
 * на ЭТОЙ ноде. В multi-node деплое распространяется на другие ноды в
 * течение одного sweep-интервала (ADR-015 §3). {found: false} — не
 * ошибка, см. startAgent.
 */
export async function stopAgent(
  agentId: string,
): Promise<AgentStatus | AgentNotFound> {
  const result = await callTool('stop_agent', { agent_id: agentId })
  return result as unknown as AgentStatus | AgentNotFound
}

/**
 * Один инстанс standalone-агентского процесса (Critic/Enrichment/Fork
 * Resolution/Pipeline Agent) из общей таблицы cks_agent_liveness (см.
 * cks-runtime ADR-014, cks-mcp ADR-008 / list_processes schema.py).
 *
 * ВАЖНО: в отличие от AgentStatus (sweeper'ы этого MCP-сервера), это
 * общая для всех процессов таблица хранилища — в multi-node деплое
 * может вернуть данные с другого узла. instance_id — новый uuid4 на
 * каждый рестарт процесса, старые записи остаются как история.
 */
export interface ProcessStatus {
  instance_id: string
  process_kind: 'critic' | 'enrichment' | 'fork_resolution' | 'pipeline'
  hostname: string
  pid: number
  liveness_interval_s: number
  started_at: string
  last_heartbeat_at: string
  current_task_id: number | null
  current_task_type: string | null
  status: 'alive' | 'stopped'
}

/** Ответ process_status, когда данный process_kind ни разу не писал
 *  heartbeat (или хранилище было очищено с тех пор). */
export interface ProcessNotFound {
  process_kind: string
  found: false
}

/** list_processes, как и list_agents, не принимает session_id — данные
 *  не привязаны к конкретной сессии/графу. */
export async function listProcesses(): Promise<{ processes: ProcessStatus[] }> {
  const result = await callTool('list_processes', {})
  return { processes: (result.processes as ProcessStatus[]) ?? [] }
}

export async function getProcessStatus(
  processKind: ProcessStatus['process_kind'],
): Promise<ProcessStatus | ProcessNotFound> {
  const result = await callTool('process_status', { process_kind: processKind })
  return result as unknown as ProcessStatus | ProcessNotFound
}

/** Ответ request_process_stop — запрос принят/не принят, это НЕ означает,
 *  что процесс уже остановился (см. ProcessStopNotFound и описание тула:
 *  задержка до фактической остановки ~ один liveness_interval + время
 *  завершения текущей задачи). Нужно опрашивать getProcessStatus дальше,
 *  чтобы увидеть status: 'stopped'. */
export interface ProcessStopAccepted {
  process_kind: string
  instance_id: string
  accepted: boolean
}

/** Ни один инстанс этого process_kind никогда не писал heartbeat — не
 *  ошибка, тот же конвенция, что и у process_status. */
export interface ProcessStopNotFound {
  process_kind: string
  found: false
}

/**
 * Запрашивает graceful-остановку standalone-процесса (Critic/Enrichment/
 * Fork Resolution/Pipeline Agent) — единственное write-действие, доступное
 * для этих процессов: старт-тула не существует, cks-mcp не может спавнить
 * новый OS-процесс (cks-runtime ADR-016 §4).
 */
export async function requestProcessStop(
  processKind: ProcessStatus['process_kind'],
): Promise<ProcessStopAccepted | ProcessStopNotFound> {
  const result = await callTool('request_process_stop', {
    process_kind: processKind,
  })
  return result as unknown as ProcessStopAccepted | ProcessStopNotFound
}

export async function evolveKnowledge(
  sessionId: string,
  operations: EvolveOperation[],
): Promise<EvolveResult> {
  const result = await callTool('evolve_knowledge', {
    session_id: sessionId,
    // json_data формально required в схеме бэкенда, но handler.py игнорирует
    // его при переданном session_id (ветка `if session_id: ... else: parse
    // json_data`) — пустая строка тут ничего не парсит и не используется.
    json_data: '',
    operations,
  })
  return result as unknown as EvolveResult
}

/** Удобный хелпер для формы создания одного узла. */
export function addObjectOperation(
  identity: { id: string; type: string; name: string },
  structure: Record<string, unknown> = {},
): EvolveOperation {
  return { type: 'add_object', identity, structure }
}

/** Удобный хелпер для формы создания одной связи между двумя узлами. */
export function addRelationOperation(
  identity: { id: string; type: string; name: string },
  participants: [string, string],
  relationType: string,
  structure: Record<string, unknown> = {},
): EvolveOperation {
  return {
    type: 'add_relation',
    identity,
    participants,
    relation_type: relationType,
    structure,
  }
}

// ---------------------------------------------------------------------------
// start_pipeline (cks-mcp ADR-007 agent pipeline) -- kicked off from the
// graph view's multi-select ("Start Pipeline" toolbar button, see
// GraphPage/PipelineStartButton).
// ---------------------------------------------------------------------------

export interface StartPipelineResult {
  run_id: string
  status: string
}

export async function startPipeline(
  sessionId: string,
  objectIds: string[],
  mode?: string,
): Promise<StartPipelineResult> {
  const result = await callTool('start_pipeline', {
    session_id: sessionId,
    object_ids: objectIds,
    ...(mode ? { mode } : {}),
  })
  return result as unknown as StartPipelineResult
}

// ---------------------------------------------------------------------------
// list_pipeline_runs (cks-mcp ADR-007 agent pipeline) -- backs the Run
// History panel (see src/features/pipeline-runs/RunHistoryPanel.tsx). The
// tool's own response uses snake_case run_id/session_id/started_at/... and
// object_ids (see cks-mcp src/cks_mcp/tools/list_pipeline_runs/schema.py);
// this adapter maps that onto the camelCase PipelineRun/PipelineRunStep
// shape src/features/pipeline-runs/types.ts already defines, so the rest
// of the feature never has to know about the wire format.
// ---------------------------------------------------------------------------

interface RawPipelineRunStep {
  name: string
  status: string
  started_at: string | null
  completed_at: string | null
  error?: string | null
  dead_letter_task_id?: number | null
}

interface RawPipelineRun {
  run_id: string
  session_id: string
  status: string
  started_at: string
  updated_at: string
  object_ids: string[]
  steps: RawPipelineRunStep[]
}

interface ListPipelineRunsResponse {
  runs: RawPipelineRun[]
  count: number
}

export async function listPipelineRuns(
  sessionId: string,
): Promise<PipelineRun[]> {
  const result = (await callTool('list_pipeline_runs', {
    session_id: sessionId,
  })) as unknown as ListPipelineRunsResponse

  return (result.runs ?? []).map((run) => ({
    runId: run.run_id,
    sessionId: run.session_id,
    status: run.status as PipelineRunStatus,
    startedAt: run.started_at,
    updatedAt: run.updated_at,
    objectIds: run.object_ids,
    steps: run.steps.map((step) => ({
      name: step.name as PipelineStepName,
      status: step.status as PipelineStepStatus,
      startedAt: step.started_at,
      completedAt: step.completed_at,
      error: step.error ?? null,
      deadLetterTaskId: step.dead_letter_task_id ?? null,
    })),
  }))
}

// ---------------------------------------------------------------------------
// Dead-letter inbox (list_dead_lettered_conflicts / review_dead_letter /
// approve_resolution / reject_resolution, cks-mcp) -- surfaced in
// cks-studio's Dead Letter page (see src/pages/DeadLetterPage.tsx) so a
// human can review conflict tasks a Critic agent has permanently given up
// on, instead of them just sitting in the outbox unseen.
// ---------------------------------------------------------------------------

export interface DeadLetterTask {
  task_id: number
  task_type: string
  session_id: string
  payload: Record<string, unknown>
  retry_count: number
}

interface ListDeadLetteredConflictsResponse {
  tasks: DeadLetterTask[]
  count: number
  /** false under a storage backend without outbox support (e.g. the
   *  default in-memory backend) -- tasks is always [] in that case. */
  supported: boolean
}

export async function listDeadLetteredConflicts(
  taskType?: 'gossip_conflict' | 'inference_conflict',
  sessionId?: string,
): Promise<ListDeadLetteredConflictsResponse> {
  const result = await callTool('list_dead_lettered_conflicts', {
    ...(taskType ? { task_type: taskType } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
  })
  // callTool's return type is a loosely-typed Record<string, unknown> --
  // if the tool ever comes back with an unexpected/partial shape (e.g. a
  // tool-level error object without a `tasks` field, or a backend that
  // omits `tasks` when there's nothing to report), normalize here so
  // callers can always rely on `tasks` being an array. Without this,
  // `undefined` propagates straight into DeadLetterPanel's `tasks.map`.
  const raw = result as Partial<ListDeadLetteredConflictsResponse>
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : []
  return {
    tasks,
    count: typeof raw.count === 'number' ? raw.count : tasks.length,
    supported: raw.supported ?? true,
  }
}

/** {'tool': <resolution tool name>, 'arguments': {...}} -- ready to pass
 *  straight to approveResolution, optionally with manual edits. */
export interface ProposedResolution {
  tool: string
  arguments: Record<string, unknown>
  /** Set instead of tool/arguments when the payload didn't carry enough
   *  information to propose a resolution (task_type-specific — see
   *  cks-mcp review_dead_letter handler's _propose_* helpers). */
  error?: string
  message?: string
}

export interface ReviewDeadLetterResult {
  task_id: number
  task_type: string
  session_id: string
  payload: Record<string, unknown>
  retry_count: number
  last_error: string | null
  proposed_resolution: ProposedResolution
}

/** Set when task_id isn't currently dead-lettered, or the backend has no
 *  outbox support -- review_dead_letter returns this instead of throwing. */
export interface DeadLetterReviewError {
  error: string
  message: string
}

export async function reviewDeadLetter(
  taskId: number,
): Promise<ReviewDeadLetterResult | DeadLetterReviewError> {
  const result = await callTool('review_dead_letter', { task_id: taskId })
  return result as unknown as ReviewDeadLetterResult | DeadLetterReviewError
}

export interface ApproveResolutionResult {
  approved: boolean
  task_id: number
  resolution_result?: Record<string, unknown>
  error?: string
  message?: string
}

/** `resolution` is normally the `proposed_resolution` a prior
 *  reviewDeadLetter() call returned for the same task_id, optionally with
 *  manual edits (e.g. a different winner_id). */
export async function approveResolution(
  taskId: number,
  resolution: { tool: string; arguments: Record<string, unknown> },
): Promise<ApproveResolutionResult> {
  const result = await callTool('approve_resolution', {
    task_id: taskId,
    resolution,
  })
  return result as unknown as ApproveResolutionResult
}

export interface RejectResolutionResult {
  rejected: boolean
  task_id: number
  reason?: string
  error?: string
  message?: string
}

export async function rejectResolution(
  taskId: number,
  reason?: string,
): Promise<RejectResolutionResult> {
  const result = await callTool('reject_resolution', {
    task_id: taskId,
    ...(reason ? { reason } : {}),
  })
  return result as unknown as RejectResolutionResult
}

export interface RetryDeadLetterSuccess {
  retried: true
  task_id: number
}

/** `error` is `'task_not_found'` when the task isn't currently
 *  dead-lettered (e.g. already retried/approved/rejected elsewhere), or
 *  `'not_supported'` when the connected storage backend has no
 *  requeueing support (cks-runtime < v1.58.0 / no outbox support). */
export interface RetryDeadLetterFailure {
  retried: false
  error: 'task_not_found' | 'not_supported' | string
  message: string
}

export type RetryDeadLetterResult =
  | RetryDeadLetterSuccess
  | RetryDeadLetterFailure

/** Requeues a DEAD-lettered conflict task back to pending (retry_dead_letter,
 *  cks-mcp >= v1.77.0 / cks-runtime >= v1.58.0's retry_dead_letter_task). */
export async function retryDeadLetter(
  taskId: number,
): Promise<RetryDeadLetterResult> {
  const result = await callTool('retry_dead_letter', { task_id: taskId })
  return result as unknown as RetryDeadLetterResult
}

// ---------------------------------------------------------------------------
// ai_chat (cks-mcp ADR-011 / cks-studio ADR-001)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant'
  /** String for plain turns; block array when it carries tool_use/tool_result
   *  content (mirrors the Anthropic Messages API content shape 1:1, since
   *  it's round-tripped through ai_chat's 'messages' as-is — see ADR-001 §2). */
  content: string | Record<string, unknown>[]
}

export interface ExecutedToolCall {
  name: string
  arguments: Record<string, unknown>
  result: Record<string, unknown>
  is_error: boolean
}

export interface AiChatResult {
  reply: string
  tool_calls: ExecutedToolCall[]
  messages: ChatMessage[]
  /** Set when this result is ai_chat's iteration-cap fallback reply
   *  ("Reached the tool-call iteration limit without a final answer.")
   *  rather than a genuine final answer -- lets callers offer a
   *  Retry/Continue action instead of treating this as a normal,
   *  finished turn. See cks_mcp.tools.ai_chat.handler. */
  truncated?: boolean
}

/** Names of tools whose successful execution means the graph may have
 *  changed and the canvas should be refetched (see ADR-001 §5). Kept in
 *  sync manually with cks-mcp's graph-mutating tool set -- there's no
 *  tool-metadata flag for this yet, so this is the same kind of small,
 *  explicit constant AgentPanel's PROCESS_KINDS-style lists already are
 *  elsewhere in this codebase. */
const GRAPH_MUTATING_TOOLS = new Set([
  'evolve_knowledge',
  'revert_version',
  'merge_branch',
  'merge_knowledge',
  'resolve_contradiction',
  'resolve_temporal_conflict',
  'resolve_gossip_conflict',
  'refresh_verification',
])

export function toolCallsMutatedGraph(calls: ExecutedToolCall[]): boolean {
  return calls.some((c) => !c.is_error && GRAPH_MUTATING_TOOLS.has(c.name))
}

export async function aiChat(
  sessionId: string,
  messages: ChatMessage[],
  model?: string | null,
): Promise<AiChatResult> {
  const args: Record<string, unknown> = { session_id: sessionId, messages }
  // Пропускаем 'model' вовсе, когда не выбран — это значит "использовать
  // дефолт провайдера", тот же смысл, что и null/undefined на схеме
  // ai_chat в cks-mcp (см. src/cks_mcp/tools/ai_chat/schema.py).
  if (model) {
    args.model = model
  }
  const result = await callTool('ai_chat', args)
  return result as unknown as AiChatResult
}

// ---------------------------------------------------------------------------
// LLM provider status (get_llm_status, cks-mcp ADR-011 §6)
// ---------------------------------------------------------------------------

/**
 * Ответ get_llm_status (см. cks-mcp src/cks_mcp/tools/get_llm_status/
 * handler.py). Studio никогда не видит ANTHROPIC_API_KEY/CKS_OLLAMA_HOST
 * и т.п. напрямую — только этот уже разрешённый статус.
 *
 * 'provider' — что реально будет использовано ai_chat/construct_knowledge
 * прямо сейчас, после разрешения CKS_LLM_PROVIDER=auto|ollama|anthropic
 * на сервере; 'none' значит ни один провайдер не настроен/недоступен.
 * 'model' — null только когда provider === 'none'.
 */
export interface LLMStatus {
  provider: 'ollama' | 'anthropic' | 'openai_compatible' | 'google' | 'none'
  ollama_available: boolean
  anthropic_configured: boolean
  openai_compatible_configured: boolean
  google_configured: boolean
  model: string | null
}

/** Не принимает session_id — конфигурация провайдера общая для сервера,
 *  не привязана к конкретной сессии/графу (как list_agents/list_processes). */
export async function getLLMStatus(): Promise<LLMStatus> {
  const result = await callTool('get_llm_status', {})
  return result as unknown as LLMStatus
}

// ---------------------------------------------------------------------------
// LLM model list (list_llm_models, cks-mcp)
// ---------------------------------------------------------------------------

/** Одна модель в ответе list_llm_models (см. cks-mcp
 *  src/cks_mcp/tools/list_llm_models/handler.py). Для ollama — реальные
 *  установленные модели (GET /api/tags), для anthropic/openai_compatible —
 *  захардкоженный короткий список. */
export interface LLMModel {
  name: string
}

interface ListLLMModelsResponse {
  provider: LLMStatus['provider']
  models: LLMModel[]
}

/** Не принимает session_id — та же причина, что и у getLLMStatus. */
export async function listLLMModels(): Promise<LLMModel[]> {
  const result = await callTool('list_llm_models', {})
  return (result as unknown as ListLLMModelsResponse).models
}

// ---------------------------------------------------------------------------
// Runtime/tool/LLM metrics dashboard (get_metrics, cks-mcp)
// ---------------------------------------------------------------------------

/** Loosely typed on purpose: get_metrics' payload (runtime_metrics,
 *  tool_telemetry, critic_agent_metrics, llm_telemetry) is a dashboard
 *  blob whose exact shape is an implementation detail of cks-mcp/
 *  cks-runtime (see get_metrics/schema.py) -- callers that need a
 *  specific field should narrow it themselves rather than this module
 *  encoding every nested counter. */
export interface MetricsSnapshot {
  runtime_metrics?: Record<string, unknown>
  tool_telemetry?: Record<string, unknown>
  critic_agent_metrics?: Record<string, unknown>
  llm_telemetry?: Record<string, unknown>
}

/** Не принимает session_id — как и getLLMStatus/listAgents, метрики не
 *  привязаны к конкретной сессии/графу. */
export async function getMetrics(): Promise<MetricsSnapshot> {
  const result = await callTool('get_metrics', {})
  return result as unknown as MetricsSnapshot
}
