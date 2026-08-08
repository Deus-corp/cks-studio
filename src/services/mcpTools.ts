import type { SubgraphResult } from '@/shared/types/graph'
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
  })
  return result as unknown as SubgraphResult
}
