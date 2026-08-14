import type {
  CksObject,
  EvolveOperation,
  EvolveResult,
  ExplainDiffResult,
  GraphHealthResult,
  GraphHealthUnavailable,
  GraphRegistryEntry,
  ListVersionsResult,
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

// ---------------------------------------------------------------------------
// Graph Gallery (Memory Agent v1/v2): list_graphs / search_graphs / register_graph
// ---------------------------------------------------------------------------

export async function listGraphs(
  options: { tag?: string; publicOnly?: boolean } = {},
): Promise<GraphRegistryEntry[]> {
  const result = await callTool('list_graphs', {
    ...(options.tag ? { tag: options.tag } : {}),
    public_only: options.publicOnly ?? false,
  })
  return (result.graphs as GraphRegistryEntry[] | undefined) ?? []
}

export async function searchGraphs(
  query: string,
  options: { tag?: string; publicOnly?: boolean } = {},
): Promise<GraphRegistryEntry[]> {
  const result = await callTool('search_graphs', {
    query,
    ...(options.tag ? { tag: options.tag } : {}),
    public_only: options.publicOnly ?? false,
  })
  return (result.graphs as GraphRegistryEntry[] | undefined) ?? []
}

export async function registerGraph(params: {
  name: string
  sessionId: string
  description?: string
  tags?: string
  isPublic?: boolean
}): Promise<{ registered: boolean; name: string; public: boolean }> {
  const result = await callTool('register_graph', {
    name: params.name,
    session_id: params.sessionId,
    description: params.description ?? '',
    tags: params.tags ?? '',
    public: params.isPublic ?? false,
  })
  return result as unknown as {
    registered: boolean
    name: string
    public: boolean
  }
}

export async function checkGraphHealth(
  name: string,
): Promise<GraphHealthResult | GraphHealthUnavailable> {
  const result = await callTool('check_graph_health', { name })
  return result as unknown as GraphHealthResult | GraphHealthUnavailable
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
  return result as unknown as ExplainDiffResult
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
): Promise<ListDeadLetteredConflictsResponse> {
  const result = await callTool('list_dead_lettered_conflicts', {
    ...(taskType ? { task_type: taskType } : {}),
  })
  return result as unknown as ListDeadLetteredConflictsResponse
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
  provider: 'ollama' | 'anthropic' | 'none'
  ollama_available: boolean
  anthropic_configured: boolean
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
