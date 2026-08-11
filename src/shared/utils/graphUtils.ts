import type { Edge, Node } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import type { CksObject, SubgraphResult } from '@/shared/types/graph'

/** Type guard for a dropped .json file's parsed content -- used by both
 *  GraphCanvas (2D) and GraphCanvas3D's drag-and-drop subgraph import so
 *  the two canvases validate dropped files identically. */
export function looksLikeSubgraphResult(
  value: unknown,
): value is SubgraphResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.nodes) && Array.isArray(v.edges)
}

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
    // Filled arrowhead so relation direction reads at a glance instead
    // of requiring a click-through to the side panel to tell source
    // from target.
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: '#6b7280',
    },
    labelStyle: {
      fill: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 500,
    },
    labelBgStyle: { fill: 'var(--color-surface-1)', fillOpacity: 0.92 },
    labelBgPadding: [5, 3] as [number, number],
    labelBgBorderRadius: 4,
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

/**
 * Кратчайший путь между двумя узлами (BFS по неориентированному графу
 * рёбер — направление связи для подсветки пути неважно, в отличие от
 * traceInferenceChain, где направление принципиально).
 *
 * Возвращает Set id рёбер, входящих в путь, либо пустой Set, если пути
 * нет (в т.ч. если fromId === toId, или один из узлов отсутствует).
 */
export function findPathBetweenNodes(
  fromId: string,
  toId: string,
  edges: Edge[],
): Set<string> {
  if (fromId === toId) return new Set()

  // adjacency: nodeId -> [{ edgeId, neighborId }]
  const adjacency = new Map<string, { edgeId: string; neighborId: string }[]>()
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency
      .get(edge.source)
      ?.push({ edgeId: edge.id, neighborId: edge.target })
    adjacency
      .get(edge.target)
      ?.push({ edgeId: edge.id, neighborId: edge.source })
  }

  const visited = new Set<string>([fromId])
  // nodeId -> { edgeId used to reach it, previous nodeId }
  const cameFrom = new Map<string, { edgeId: string; prevId: string }>()
  const queue: string[] = [fromId]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (current === toId) break
    for (const { edgeId, neighborId } of adjacency.get(current) ?? []) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)
      cameFrom.set(neighborId, { edgeId, prevId: current })
      queue.push(neighborId)
    }
  }

  if (!visited.has(toId)) return new Set()

  const pathEdgeIds = new Set<string>()
  let cursor = toId
  while (cursor !== fromId) {
    const step = cameFrom.get(cursor)
    if (!step) break
    pathEdgeIds.add(step.edgeId)
    cursor = step.prevId
  }
  return pathEdgeIds
}
