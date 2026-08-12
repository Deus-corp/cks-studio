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
// Hub nodes (many incident edges) get a little extra vertical room too,
// same sqrt-tapered idea as the width bonus below, capped well short of
// making the graph lopsided.
const MAX_NODE_HEIGHT = 100
// Rough px-per-character for the node label font/weight used in
// GraphNode's rendering, plus a fixed allowance for the type icon, the
// colored dot, and horizontal padding on both sides.
const CHAR_WIDTH = 8
const LABEL_CHROME_WIDTH = 60
// How much a node's degree (incident edge count) can widen/heighten it
// beyond its label-based size. sqrt rather than linear, and applied
// conservatively (small coefficient) since dagre needs stable, mostly
// label-driven dimensions for predictable spacing -- this is a gentle
// nudge, not the primary driver of size, unlike the 3D cards where
// degree is the main signal.
const DEGREE_WIDTH_BONUS = 9
const DEGREE_HEIGHT_BONUS = 6

function computeDegrees(nodes: Node[], edges: Edge[]): Map<string, number> {
  const degree = new Map<string, number>()
  for (const node of nodes) degree.set(node.id, 0)
  for (const edge of edges) {
    if (degree.has(edge.source)) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    }
    if (degree.has(edge.target)) {
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
    }
  }
  return degree
}

function labelWidth(node: Node, degree: number): number {
  const label = (node.data?.label as string | undefined) ?? node.id
  const estimated =
    label.length * CHAR_WIDTH +
    LABEL_CHROME_WIDTH +
    Math.sqrt(degree) * DEGREE_WIDTH_BONUS
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, estimated))
}

function nodeHeight(degree: number): number {
  const estimated = NODE_HEIGHT + Math.sqrt(degree) * DEGREE_HEIGHT_BONUS
  return Math.min(MAX_NODE_HEIGHT, estimated)
}

export function useGraphLayout(
  nodes: Node[],
  edges: Edge[],
  rankdir: 'TB' | 'LR' = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    if (nodes.length === 0) return { nodes, edges }

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
      rankdir,
      // Long labels (ADR-... titles etc.) make nodes wider than the old
      // fixed 220px, so separation needs more room too, or adjacent
      // wide nodes/ranks overlap even with per-node widths set below.
      ranksep: 110,
      nodesep: 90,
      marginx: 40,
      marginy: 40,
    })

    // Degree (incident edge count) drives both a small size bonus below
    // and is passed through to CksNode via data.degree so it can scale
    // its own font/icon size and show a connection-count badge -- same
    // "hub nodes read as visually important" intent as the 3D cards,
    // just applied more conservatively since dagre needs mostly stable,
    // label-driven dimensions for predictable spacing.
    const degrees = computeDegrees(nodes, edges)

    const widths = new Map<string, number>()
    const heights = new Map<string, number>()
    for (const node of nodes) {
      const degree = degrees.get(node.id) ?? 0
      const width = labelWidth(node, degree)
      const height = nodeHeight(degree)
      widths.set(node.id, width)
      heights.set(node.id, height)
      g.setNode(node.id, { width, height })
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    const laidOutNodes = nodes.map((node) => {
      const pos = g.node(node.id)
      const width = widths.get(node.id) ?? MIN_NODE_WIDTH
      const height = heights.get(node.id) ?? NODE_HEIGHT
      return {
        ...node,
        data: {
          ...node.data,
          degree: degrees.get(node.id) ?? 0,
        },
        position: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
        },
      }
    })

    return { nodes: laidOutNodes, edges }
  }, [nodes, edges, rankdir])
}
