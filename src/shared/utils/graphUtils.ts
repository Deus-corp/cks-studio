import type { CksObject, SubgraphResult } from '@/shared/types/graph'
import type { Edge, Node } from '@xyflow/react'

/** Тип ребра в ответе subgraph */
type EdgeData = { source: string; target: string; relation_type: string }

/** Преобразует SubgraphResult в массив узлов и рёбер React Flow */
export function cksToReactFlow(data: SubgraphResult): {
  nodes: Node[]
  edges: Edge[]
} {
  const nodes: Node[] = data.nodes.map((obj: CksObject) => ({
    id: obj.identity.id,
    type: 'cksNode',
    position: { x: 0, y: 0 },
    data: {
      label: obj.identity.name,
      cksType: obj.identity.type,
      structure: obj.structure,
    },
  }))

  const edges: Edge[] = data.edges.map((rel: EdgeData, idx: number) => ({
    id: `edge-${rel.source}-${rel.target}-${idx}`,
    source: rel.source,
    target: rel.target,
    label: rel.relation_type,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#6b7280' },
  }))

  return { nodes, edges }
}

/** Собирает все входящие рёбра от заданного узла (рекурсивно вглубь). */
export function traceInferenceChain(
  seedId: string,
  edges: Edge[],
): Set<string> {
  const result = new Set<string>()
  const visited = new Set<string>()

  function dfs(currentId: string) {
    if (visited.has(currentId)) return
    visited.add(currentId)
    for (const edge of edges) {
      if (edge.target === currentId) {
        result.add(edge.id)
        dfs(edge.source)
      }
    }
  }

  dfs(seedId)
  return result
}
