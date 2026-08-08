import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import { useMemo } from 'react'

const NODE_WIDTH = 220
const NODE_HEIGHT = 60

export function useGraphLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    if (nodes.length === 0) return { nodes, edges }

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
      rankdir: 'TB',
      ranksep: 90,
      nodesep: 70,
      marginx: 40,
      marginy: 40,
    })

    for (const node of nodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    const laidOutNodes = nodes.map((node) => {
      const pos = g.node(node.id)
      return {
        ...node,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      }
    })

    return { nodes: laidOutNodes, edges }
  }, [nodes, edges])
}
