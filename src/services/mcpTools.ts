import type {
  CksObject,
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
