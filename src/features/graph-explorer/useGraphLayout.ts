import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import { useMemo } from 'react'

// Fallback/minimum width for nodes with short or missing labels (icon +
// padding + a couple words still fits comfortably at this size).
const MIN_NODE_WIDTH = 220
// Cap so a single very long label (e.g. a full ADR title) doesn't produce
// an absurdly wide node -- it wraps/truncates in the node's own CSS instead.
const MAX_NODE_WIDTH = 420
const NODE_HEIGHT = 60
// Rough px-per-character for the node label font/weight used in
// GraphNode's rendering, plus a fixed allowance for the type icon, the
// colored dot, and horizontal padding on both sides.
const CHAR_WIDTH = 8
const LABEL_CHROME_WIDTH = 60

function labelWidth(node: Node): number {
  const label = (node.data?.label as string | undefined) ?? node.id
  const estimated = label.length * CHAR_WIDTH + LABEL_CHROME_WIDTH
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, estimated))
}

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
      // Long labels (ADR-... titles etc.) make nodes wider than the old
      // fixed 220px, so separation needs more room too, or adjacent
      // wide nodes/ranks overlap even with per-node widths set below.
      ranksep: 110,
      nodesep: 90,
      marginx: 40,
      marginy: 40,
    })

    const widths = new Map<string, number>()
    for (const node of nodes) {
      const width = labelWidth(node)
      widths.set(node.id, width)
      g.setNode(node.id, { width, height: NODE_HEIGHT })
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    const laidOutNodes = nodes.map((node) => {
      const pos = g.node(node.id)
      const width = widths.get(node.id) ?? MIN_NODE_WIDTH
      return {
        ...node,
        position: {
          x: pos.x - width / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      }
    })

    return { nodes: laidOutNodes, edges }
  }, [nodes, edges])
}
