import type { SubgraphResult } from '@/shared/types/graph'
import type { Edge, Node } from '@xyflow/react'

/** Преобразует SubgraphResult в массив узлов и рёбер React Flow */
export function cksToReactFlow(data: SubgraphResult): {
  nodes: Node[]
  edges: Edge[]
} {
  const nodes: Node[] = data.nodes.map((obj) => ({
    id: obj.identity.id,
    type: 'cksNode', // кастомный тип узла (создадим позже)
    position: { x: 0, y: 0 }, // Dagre расставит сам
    data: {
      label: obj.identity.name,
      cksType: obj.identity.type,
      structure: obj.structure,
    },
  }))

  const edges: Edge[] = data.edges.map((rel, idx) => ({
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

/** Собирает все ребра цепочки depends_on от заданного узла (рекурсивно вглубь) */
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
      if (edge.target === currentId && edge.label === 'depends_on') {
        result.add(edge.id)
        dfs(edge.source)
      }
    }
  }

  dfs(seedId)
  return result
}
