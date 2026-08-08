import type { CksObject, SubgraphResult } from '@/shared/types/graph'
import { callTool } from './mcpClient'

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
  return result as unknown as SubgraphResult
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
