import type {
  CksObject,
  GraphHealthResult,
  GraphHealthUnavailable,
  GraphRegistryEntry,
  SubgraphResult,
} from '@/shared/types/graph'
import { callTool } from './mcpClient'

/** Плоская форма ноды, которую в compact_mode реально отдаёт query_subgraph_tool. */
interface CompactSubgraphNode {
  id: string
  type: string
  name: string
  props: Record<string, unknown>
}

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
 * - узел — плоский {id, type, name, props}, а не канонический
 *   {identity: {id, type, name}, structure} как в serialize_knowledge;
 * - ребро использует ключ `type`, а не `relation_type`.
 *
 * TODO(cks-mcp): когда backend начнёт отдавать канонический формат нод
 * (см. обсуждение "query_subgraph без seed_ids"), этот адаптер можно будет
 * упростить до простого unwrap result.subgraph без переименования полей.
 */
export function normalizeCompactSubgraphResponse(
  raw: Record<string, unknown>,
): SubgraphResult {
  const response = raw as CompactQuerySubgraphResponse
  const rawNodes = response.subgraph?.nodes ?? []
  const rawEdges = response.subgraph?.edges ?? []

  const nodes: CksObject[] = rawNodes.map((n) => ({
    identity: { id: n.id, type: n.type, name: n.name },
    structure: n.props ?? {},
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
