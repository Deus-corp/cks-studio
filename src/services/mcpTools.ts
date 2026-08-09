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
