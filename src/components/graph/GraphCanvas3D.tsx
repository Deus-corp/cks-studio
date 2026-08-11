// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * 3D counterpart to GraphCanvas. Same data source (useGraphStore) and same
 * node-click contract (onNodeSelect), but rendered as a force-directed
 * point cloud in a sphere via 3d-force-graph/three.js instead of a 2D
 * dagre layout via @xyflow/react.
 *
 * Why this exists: dagre's rankdir:'TB' layout puts every same-rank node
 * in a single horizontal row (see useGraphLayout.ts) -- a graph with many
 * nodes sharing a rank (e.g. many Tools implementing one ADR) ends up very
 * wide and short. 3D force-direction spreads nodes over a volume instead,
 * so a graph like that reads as a roughly spherical cluster rather than a
 * stretched-out ribbon.
 *
 * This is a first-pass prototype: node click/select, always-on labels,
 * degree-based sizing, and hover neighbor-highlighting work, but
 * path-highlighting, drag-and-drop subgraph import, relation-draft
 * participant picking, and search (all present in GraphCanvas) are not
 * wired up yet. It intentionally reuses the same hiddenTypes filtering
 * so switching modes doesn't reset what's visible.
 */

import type { Node } from '@xyflow/react'
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { GraphEmptyState } from '@/components/graph/GraphEmptyState'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import type { GraphState } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { nodeTypeColor } from '@/shared/constants/nodeTypes'

interface Graph3DNode {
  id: string
  name: string
  cksType: string
  color: string
  /** Number of edges touching this node (in + out). Drives sphere
   *  radius so hub nodes (e.g. cks-mcp, cks-runtime) read as visually
   *  more important than a single leaf Tool. */
  degree: number
  // Populated by the force simulation at runtime (not set by us) --
  // optional because they don't exist until the first simulation tick.
  x?: number
  y?: number
  z?: number
  // Attached by 3d-force-graph itself once a custom nodeThreeObject has
  // been rendered for this datum -- used from onNodeHover to dim/reset
  // sibling nodes' materials directly without forcing a full data
  // refresh (see the "neighbor highlight" effect below).
  __threeObj?: THREE.Object3D
}

interface Graph3DLink {
  source: string
  target: string
  label: string
}

/** Shape links actually have once 3d-force-graph's simulation has run --
 *  it mutates link.source/target from the original id strings into
 *  references to the resolved node objects. Only used when reading data
 *  back via graph.graphData() (hover handler), never when building it. */
interface RuntimeGraph3DLink extends Omit<Graph3DLink, 'source' | 'target'> {
  source: string | Graph3DNode
  target: string | Graph3DNode
  __lineObj?: THREE.Object3D
}

export function GraphCanvas3D({
  onNodeSelect,
  isLoading,
}: {
  onNodeSelect?: (node: Node) => void
  isLoading?: boolean
}) {
  const nodes = useGraphStore((s: GraphState) => s.nodes)
  const edges = useGraphStore((s: GraphState) => s.edges)
  const hiddenTypes = useGraphStore((s: GraphState) => s.hiddenTypes)
  const selectNode = useGraphStore((s: GraphState) => s.selectNode)

  const containerRef = useRef<HTMLDivElement>(null)
  // ForceGraphInstance is mutable/imperative (three.js scene handle), not
  // React state -- re-rendering on every internal engine tick would defeat
  // the point of an off-React render loop, so it's held in a ref and only
  // read/written from effects.
  const graphRef = useRef<ForceGraph3DInstance<
    Graph3DNode,
    Graph3DLink
  > | null>(null)
  // The mount effect below runs once and captures its closure at that
  // point; onNodeClick needs the *current* nodes array (with full
  // .data.structure, not just what Graph3DNode carries) to hand SidePanel
  // the same shape GraphCanvas does, so it's kept in a ref instead of a
  // dependency that would force tearing down/recreating the WebGL scene
  // on every graph update.
  const nodesRef = useRef<Node[]>(nodes)
  nodesRef.current = nodes
  // Adjacency built alongside graphData in the data effect below, read
  // by onNodeHover in the mount effect. A ref (not state) because hover
  // firing on every mouse-move must never trigger a React re-render.
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map())

  // Mount/unmount the three.js scene once. Data is pushed in via
  // .graphData() in the effect below rather than recreated here, so
  // resizing the container or reacting to theme changes doesn't tear
  // down and rebuild the whole WebGL context.
  useEffect(() => {
    if (!containerRef.current) return

    // 3d-force-graph's exported const is typed with the library's default
    // (non-generic) NodeObject/LinkObject; casting the constructor lets
    // the rest of this file work with our own Graph3DNode/Graph3DLink
    // shapes instead of `any`.
    const ForceGraph3DTyped = ForceGraph3D as unknown as new (
      element: HTMLElement,
    ) => ForceGraph3DInstance<Graph3DNode, Graph3DLink>

    const graph = new ForceGraph3DTyped(containerRef.current)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeLabel(
        (node) =>
          `${(node as Graph3DNode).cksType}: ${(node as Graph3DNode).name}`,
      )
      // Custom node rendering: a sphere (radius from degree, so hub
      // components read as visually bigger than leaf nodes) plus a
      // SpriteText label that's always visible -- the default renderer
      // only shows nodeLabel on hover via a tooltip, which is exactly
      // what made the graph "pretty but uninformative" before this.
      .nodeThreeObject((node) => {
        const n = node as Graph3DNode
        const group = new THREE.Group()

        const radius = 2.4 + Math.sqrt(n.degree) * 1.3
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshLambertMaterial({
            color: n.color,
            transparent: true,
            opacity: 0.92,
          }),
        )
        group.add(sphere)

        // Truncate long names -- full name is still in the hover
        // tooltip via nodeLabel above.
        const label = n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name
        const sprite = new SpriteText(label)
        sprite.color = '#e5e7eb'
        sprite.textHeight = 3.2
        sprite.backgroundColor = 'rgba(15, 23, 42, 0.72)'
        sprite.padding = 1.5
        sprite.borderRadius = 2
        sprite.position.set(0, radius + 4, 0)
        group.add(sprite)

        return group
      })
      .nodeThreeObjectExtend(false)
      .linkLabel((link) => (link as Graph3DLink).label)
      .linkColor(() => 'rgba(148, 163, 184, 0.55)')
      .linkOpacity(0.6)
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .linkWidth(0.6)
      .onNodeHover((node) => {
        const hoveredId = (node as Graph3DNode | null)?.id ?? null
        const neighborIds = hoveredId
          ? (neighborsRef.current.get(hoveredId) ?? new Set())
          : null
        const { nodes: currentNodes, links: currentLinks } = graph.graphData()

        for (const gn of currentNodes as Graph3DNode[]) {
          const dim =
            hoveredId !== null &&
            gn.id !== hoveredId &&
            !neighborIds?.has(gn.id)
          const sphere = gn.__threeObj?.children.find(
            (c): c is THREE.Mesh => c instanceof THREE.Mesh,
          )
          const material = sphere?.material as
            | THREE.MeshLambertMaterial
            | undefined
          if (material) material.opacity = dim ? 0.15 : 0.92
          const sprite = gn.__threeObj?.children.find(
            (c): c is SpriteText => c instanceof SpriteText,
          )
          if (sprite) sprite.material.opacity = dim ? 0.15 : 1
        }

        for (const gl of currentLinks as RuntimeGraph3DLink[]) {
          const sourceId =
            typeof gl.source === 'string' ? gl.source : gl.source.id
          const targetId =
            typeof gl.target === 'string' ? gl.target : gl.target.id
          const touches =
            hoveredId !== null &&
            (sourceId === hoveredId || targetId === hoveredId)
          const lineMaterial = (
            gl.__lineObj as unknown as THREE.Line | undefined
          )?.material as THREE.LineBasicMaterial | undefined
          if (lineMaterial) {
            lineMaterial.opacity =
              hoveredId === null ? 0.6 : touches ? 0.9 : 0.06
            lineMaterial.transparent = true
          }
        }

        if (containerRef.current) {
          containerRef.current.style.cursor = hoveredId ? 'pointer' : 'default'
        }
      })
      .onNodeClick((node) => {
        const n = node as Graph3DNode
        selectNode(n.id)
        const fullNode = nodesRef.current.find((rn) => rn.id === n.id)
        if (fullNode) onNodeSelect?.(fullNode)
        // Recenter the camera on the clicked node, same distance out, so
        // clicking through a cluster feels like navigating rather than
        // just re-coloring a dot buried in the point cloud.
        const distance = 120
        const distRatio =
          1 + distance / Math.hypot(n.x ?? 1, n.y ?? 1, n.z ?? 1)
        graph.cameraPosition(
          {
            x: (n.x ?? 0) * distRatio,
            y: (n.y ?? 0) * distRatio,
            z: (n.z ?? 0) * distRatio,
          },
          { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 },
          800,
        )
      })

    graphRef.current = graph

    const resize = () => {
      if (!containerRef.current) return
      graph.width(containerRef.current.clientWidth)
      graph.height(containerRef.current.clientHeight)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      // 3d-force-graph has no official teardown method; releasing the
      // container's children and the ref is the documented workaround
      // for freeing the WebGL context on unmount.
      if (containerRef.current) containerRef.current.innerHTML = ''
      graphRef.current = null
    }
  }, [onNodeSelect, selectNode])

  // Push data + type-visibility filtering whenever the store changes.
  // Filtering here (not via a separate visibleNodes memo like
  // GraphCanvas) because 3d-force-graph owns its own simulation state --
  // swapping graphData wholesale on every filter toggle is the supported
  // way to update it, same as GraphCanvas swaps layoutedNodes.
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return

    const visibleNodes =
      hiddenTypes.size === 0
        ? nodes
        : nodes.filter(
            (node) =>
              !hiddenTypes.has((node.data?.cksType as string) || 'Concept'),
          )
    const visibleIds = new Set(visibleNodes.map((n) => n.id))

    const graph3DLinks: Graph3DLink[] = edges
      .filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      )
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        label: (edge.label as string) || '',
      }))

    // Degree + adjacency, derived from the same filtered edge list so
    // hidden-type nodes don't inflate a hub's apparent importance or
    // show up as a "neighbor" while invisible.
    const degree = new Map<string, number>()
    const neighbors = new Map<string, Set<string>>()
    for (const id of visibleIds) {
      degree.set(id, 0)
      neighbors.set(id, new Set())
    }
    for (const link of graph3DLinks) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1)
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1)
      neighbors.get(link.source)?.add(link.target)
      neighbors.get(link.target)?.add(link.source)
    }
    neighborsRef.current = neighbors

    const graph3DNodes: Graph3DNode[] = visibleNodes.map((node) => {
      const cksType = (node.data?.cksType as string) || 'Concept'
      return {
        id: node.id,
        name: (node.data?.label as string) || node.id,
        cksType,
        color: nodeTypeColor(cksType),
        degree: degree.get(node.id) ?? 0,
      }
    })

    graph.graphData({ nodes: graph3DNodes, links: graph3DLinks })
  }, [nodes, edges, hiddenTypes])

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {nodes.length === 0 && !isLoading && <GraphEmptyState />}
      {isLoading && nodes.length === 0 && <GraphSkeleton />}
    </div>
  )
}
