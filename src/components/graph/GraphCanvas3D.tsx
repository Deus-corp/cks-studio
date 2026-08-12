// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * 3D counterpart to GraphCanvas. Same data source (useGraphStore) and same
 * node-click contract (onNodeSelect), but rendered as a force-directed
 * point cloud via 3d-force-graph/three.js instead of a 2D dagre layout via
 * @xyflow/react.
 *
 * Why this exists: dagre's rankdir:'TB' layout puts every same-rank node
 * in a single horizontal row (see useGraphLayout.ts) -- a graph with many
 * nodes sharing a rank (e.g. many Tools implementing one ADR) ends up very
 * wide and short. 3D force-direction spreads nodes over a volume instead,
 * so a graph like that reads as a roughly spherical cluster rather than a
 * stretched-out ribbon.
 *
 * Feature parity with GraphCanvas: always-on labels, degree-based sizing,
 * hover neighbor-highlighting, path-highlighting (Shift+click two nodes),
 * drag-and-drop subgraph (.json) import, relation-draft participant
 * picking, ⌘K search, and a soft component-containment clustering force
 * plus a ground grid for spatial orientation. Not yet ported: the 2D
 * minimap and per-node drag-to-reposition (3d-force-graph nodes are
 * simulation-driven, not manually draggable the way xyflow nodes are).
 */

import type { Edge, Node } from '@xyflow/react'
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { GraphEmptyState } from '@/components/graph/GraphEmptyState'
import { GraphSearchPalette3D } from '@/components/graph/GraphSearchPalette3D'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import type { GraphState } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { nodeTypeColor, nodeTypeIcon } from '@/shared/constants/nodeTypes'
import type { SubgraphResult } from '@/shared/types/graph'
import {
  cksToReactFlow,
  looksLikeSubgraphResult,
} from '@/shared/utils/graphUtils'

interface Graph3DNode {
  id: string
  name: string
  cksType: string
  color: string
  /** Number of edges touching this node (in + out). Drives sphere
   *  radius so hub nodes (e.g. cks-mcp, cks-runtime) read as visually
   *  more important than a single leaf Tool. */
  degree: number
  /** Nearest containing Component/Module, found by following 'contains'
   *  edges up from this node (see computeClusters below). Nodes with no
   *  containing ancestor (most ADRs, Relations) are left undefined and
   *  the clustering force simply ignores them -- they still participate
   *  in the normal charge/link forces. */
  cluster?: string
  // Populated by the force simulation at runtime (not set by us) --
  // optional because they don't exist until the first simulation tick.
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  // Attached by 3d-force-graph itself once a custom nodeThreeObject has
  // been rendered for this datum -- used from onNodeHover to dim/reset
  // sibling nodes' materials directly without forcing a full data
  // refresh (see the "neighbor highlight" effect below).
  __threeObj?: THREE.Object3D
}

interface Graph3DLink {
  id: string
  source: string
  target: string
  label: string
}

/** Shape links actually have once 3d-force-graph's simulation has run --
 *  it mutates link.source/target from the original id strings into
 *  references to the resolved node objects. Only used when reading data
 *  back via graph.graphData() (hover/highlight effects), never when
 *  building it. */
interface RuntimeGraph3DLink extends Omit<Graph3DLink, 'source' | 'target'> {
  source: string | Graph3DNode
  target: string | Graph3DNode
  __lineObj?: THREE.Object3D
}

/** Adjacency built from 'contains' edges: parent Component/Module id ->
 *  direct child ids. Used to flood-fill a cluster id (the nearest
 *  top-level Component/Module ancestor) down onto every descendant, so
 *  e.g. all Tools/ADRs belonging to cks-mcp softly pull toward the same
 *  point in space instead of floating free in the general charge cloud. */
function computeClusters(nodes: Node[], edges: Edge[]): Map<string, string> {
  const children = new Map<string, string[]>()
  for (const edge of edges) {
    if ((edge.label as string | undefined) !== 'contains') continue
    if (!children.has(edge.source)) children.set(edge.source, [])
    children.get(edge.source)?.push(edge.target)
  }

  const clusterOf = new Map<string, string>()
  const roots = nodes.filter(
    (n) => n.data?.cksType === 'Component' || n.data?.cksType === 'Module',
  )
  for (const root of roots) {
    // A node already assigned by an earlier root keeps that assignment
    // (first containing ancestor wins) rather than being reparented by
    // a second 'contains' edge from elsewhere.
    if (clusterOf.has(root.id)) continue
    clusterOf.set(root.id, root.id)
    const queue = [root.id]
    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const childId of children.get(current) ?? []) {
        if (clusterOf.has(childId)) continue
        clusterOf.set(childId, root.id)
        queue.push(childId)
      }
    }
  }
  return clusterOf
}

/** Switches nodeThreeObject between the new flat "card" rendering
 *  (PlaneGeometry-esque billboard built from a canvas texture, mirroring
 *  CksNode's 2D look) and the old sphere+SpriteText rendering. Left as a
 *  toggle rather than deleting the sphere path outright, per the "keep
 *  the old code as a fallback" requirement -- flip to false to go back
 *  to spheres without reverting this file. */
const USE_CARD_NODES = true

/** On-screen size (px) the card is designed at, matching CksNode's 2D
 *  card (220x60) so the two views read as the same visual language. The
 *  canvas is rendered at CARD_TEXTURE_SCALE× this for crisp text at
 *  typical zoom levels, then the resulting sprite is scaled back down
 *  into 3D-world units via CARD_WORLD_SCALE. These are the dimensions
 *  for an *average*-degree node -- see cardScaleForDegree, which grows
 *  or shrinks around this baseline per node so hub nodes (e.g. cks-core)
 *  read as visually more important than a leaf node (e.g. diagnostics). */
const CARD_WIDTH_PX = 220
const CARD_HEIGHT_PX = 60
const CARD_TEXTURE_SCALE = 3
const CARD_WORLD_SCALE = 0.12
const CARD_ACCENT_HEIGHT_PX = 3
const CARD_CORNER_RADIUS_PX = 8

// Degree-based sizing multipliers applied to CARD_WIDTH_PX/HEIGHT_PX.
// sqrt (not linear) so one enormous hub doesn't shrink every other card
// into insignificance by comparison -- growth tapers off instead of
// compounding, mirroring the old sphere radius formula below
// (`2.4 + sqrt(degree) * 1.3`).
const CARD_MIN_SCALE = 0.72
const CARD_MAX_SCALE = 1.85
const CARD_DEGREE_GROWTH = 0.17

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Size multiplier for a node with the given degree (number of incident
 *  edges). Both width and height scale together so the card's
 *  proportions -- and the font-size ratio derived from them in
 *  drawNodeCardCanvas -- stay constant regardless of size. */
function cardScaleForDegree(degree: number): number {
  return clamp(
    1 + Math.sqrt(degree) * CARD_DEGREE_GROWTH,
    CARD_MIN_SCALE,
    CARD_MAX_SCALE,
  )
}

/** Draws a single node "card" -- dark rounded-rect background, a
 *  type-colored accent strip along the top edge, a type emoji, the
 *  node's name, and (for connected nodes) a small degree badge -- onto
 *  an offscreen canvas, matching the 2D GraphCanvas node look (see
 *  CksNode: `borderTop: 3px solid <nodeTypeColor>`, surface-2
 *  background, Manrope label) so switching between 2D/3D views doesn't
 *  feel like switching apps. `width`/`height` are this specific card's
 *  target CSS-px size (see cardScaleForDegree) -- font sizes, accent
 *  thickness and corner radius all scale proportionally from those so a
 *  bigger hub card reads as "the same card, drawn bigger" rather than a
 *  stretched-out version of a small one. Returns the canvas for use as
 *  a THREE.CanvasTexture. */
function drawNodeCardCanvas(
  name: string,
  icon: string,
  accentColor: string,
  hovered: boolean,
  width: number = CARD_WIDTH_PX,
  height: number = CARD_HEIGHT_PX,
  degree = 0,
): HTMLCanvasElement {
  // How far this card's height has scaled from the CARD_HEIGHT_PX
  // baseline -- drives font/accent/corner scaling below so a bigger hub
  // card doesn't render with the same size text as a small leaf card.
  const sizeRatio = height / CARD_HEIGHT_PX

  const w = width * CARD_TEXTURE_SCALE
  const h = height * CARD_TEXTURE_SCALE
  const r = CARD_CORNER_RADIUS_PX * sizeRatio * CARD_TEXTURE_SCALE
  const accentH = CARD_ACCENT_HEIGHT_PX * sizeRatio * CARD_TEXTURE_SCALE

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Rounded-rect clip so the accent strip and background never bleed
  // past the card's corners.
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  ctx.save()
  ctx.clip()

  // Background -- brightens slightly on hover instead of the flat 3D
  // "dim inactive nodes" opacity trick, since a Sprite's own material
  // opacity is already used for that dimming (see onNodeHover below).
  ctx.fillStyle = hovered ? '#242b38' : '#1b212c'
  ctx.fillRect(0, 0, w, h)

  // Top accent strip, same idea as CksNode's `borderTop: 3px solid`.
  ctx.fillStyle = accentColor
  ctx.fillRect(0, 0, w, accentH)

  ctx.restore()

  if (hovered) {
    // Subtle outline instead of a heavier glow -- reads clearly against
    // the dark background without washing out the accent strip.
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2 * CARD_TEXTURE_SCALE
    ctx.beginPath()
    ctx.moveTo(r, ctx.lineWidth / 2)
    ctx.arcTo(w, 0, w, h, r)
    ctx.arcTo(w, h, 0, h, r)
    ctx.arcTo(0, h, 0, 0, r)
    ctx.arcTo(0, 0, w, 0, r)
    ctx.closePath()
    ctx.stroke()
  }

  // Icon + name, vertically centered in the space below the accent
  // strip (mirrors CksNode's flex row of icon + label).
  const contentTop = accentH
  const contentH = h - accentH
  const midY = contentTop + contentH / 2
  const paddingX = 14 * sizeRatio * CARD_TEXTURE_SCALE

  ctx.textBaseline = 'middle'
  ctx.font = `${20 * sizeRatio * CARD_TEXTURE_SCALE}px "Manrope", "Segoe UI Emoji", sans-serif`
  ctx.fillText(icon, paddingX, midY)
  const iconWidth = ctx.measureText(icon).width

  ctx.fillStyle = '#e5e7eb'
  ctx.font = `600 ${14 * sizeRatio * CARD_TEXTURE_SCALE}px "Manrope", sans-serif`
  const nameX = paddingX + iconWidth + 8 * sizeRatio * CARD_TEXTURE_SCALE
  const maxNameWidth = w - nameX - paddingX
  let displayName = name
  while (
    ctx.measureText(displayName).width > maxNameWidth &&
    displayName.length > 1
  ) {
    displayName = `${displayName.slice(0, -2)}…`
  }
  ctx.fillText(displayName, nameX, midY)

  // Degree badge -- small pill in the bottom-right corner showing the
  // connection count, so "this card is big" reads as "...because it has
  // 14 connections" rather than requiring a separate hover/click to
  // find out why. Skipped for isolated nodes (degree 0) where a "0"
  // badge would just be clutter.
  if (degree > 0) {
    const badgeText = degree > 99 ? '99+' : String(degree)
    const badgeFontSize = 10 * sizeRatio * CARD_TEXTURE_SCALE
    ctx.font = `700 ${badgeFontSize}px "Manrope", sans-serif`
    const textWidth = ctx.measureText(badgeText).width
    const badgePadX = 6 * sizeRatio * CARD_TEXTURE_SCALE
    const badgeH = badgeFontSize + 6 * sizeRatio * CARD_TEXTURE_SCALE
    const badgeW = textWidth + badgePadX * 2
    const badgeMargin = 6 * sizeRatio * CARD_TEXTURE_SCALE
    const bx = w - badgeW - badgeMargin
    const by = h - badgeH - badgeMargin
    const br = badgeH / 2

    ctx.beginPath()
    ctx.moveTo(bx + br, by)
    ctx.arcTo(bx + badgeW, by, bx + badgeW, by + badgeH, br)
    ctx.arcTo(bx + badgeW, by + badgeH, bx, by + badgeH, br)
    ctx.arcTo(bx, by + badgeH, bx, by, br)
    ctx.arcTo(bx, by, bx + badgeW, by, br)
    ctx.closePath()
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
    ctx.fill()

    ctx.fillStyle = '#94a3b8'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(badgeText, bx + badgeW / 2, by + badgeH / 2 + 0.5)
    ctx.textAlign = 'left'
  }

  return canvas
}

/** Builds the billboard Sprite for one node's card. A Sprite (rather
 *  than a PlaneGeometry mesh with a manual lookAt-camera update) always
 *  faces the camera for free, which is the "sprite-like plane" fallback
 *  called out in the task -- avoids fighting 3d-force-graph's own
 *  render loop to keep a plane's rotation in sync every frame. Card
 *  dimensions come from cardScaleForDegree so hub nodes render bigger;
 *  the resolved px size is stashed in userData so onNodeHover's hover
 *  redraw/rescale can reuse it instead of recomputing degree scaling. */
function buildNodeCardSprite(
  name: string,
  icon: string,
  accentColor: string,
  hovered: boolean,
  degree: number,
): THREE.Sprite {
  const scale = cardScaleForDegree(degree)
  const widthPx = CARD_WIDTH_PX * scale
  const heightPx = CARD_HEIGHT_PX * scale
  const canvas = drawNodeCardCanvas(
    name,
    icon,
    accentColor,
    hovered,
    widthPx,
    heightPx,
    degree,
  )
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(widthPx * CARD_WORLD_SCALE, heightPx * CARD_WORLD_SCALE, 1)
  sprite.userData.isCard = true
  sprite.userData.widthPx = widthPx
  sprite.userData.heightPx = heightPx
  sprite.userData.degree = degree
  return sprite
}

/** Custom d3-force pulling each clustered node toward its cluster's
 *  current centroid. Reads live node positions via `getNodes` on every
 *  tick (rather than closing over a snapshot) so it keeps working
 *  correctly across graphData() swaps (filtering, live updates) without
 *  needing to be re-registered. */
function makeClusterForce(getNodes: () => Graph3DNode[]) {
  const strength = 0.5
  return (alpha: number) => {
    const currentNodes = getNodes()
    const centroids = new Map<
      string,
      { x: number; y: number; z: number; count: number }
    >()
    for (const n of currentNodes) {
      if (!n.cluster) continue
      const c = centroids.get(n.cluster) ?? { x: 0, y: 0, z: 0, count: 0 }
      c.x += n.x ?? 0
      c.y += n.y ?? 0
      c.z += n.z ?? 0
      c.count += 1
      centroids.set(n.cluster, c)
    }
    for (const n of currentNodes) {
      if (!n.cluster) continue
      const c = centroids.get(n.cluster)
      // A cluster of one (nothing else assigned to this root) has
      // nothing to pull toward -- skip rather than pull it toward
      // itself, which would be a no-op anyway but wastes a tick.
      if (!c || c.count < 2) continue
      n.vx = (n.vx ?? 0) + (c.x / c.count - (n.x ?? 0)) * strength * alpha
      n.vy = (n.vy ?? 0) + (c.y / c.count - (n.y ?? 0)) * strength * alpha
      n.vz = (n.vz ?? 0) + (c.z / c.count - (n.z ?? 0)) * strength * alpha
    }
  }
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
  const setNodes = useGraphStore((s: GraphState) => s.setNodes)
  const setEdges = useGraphStore((s: GraphState) => s.setEdges)
  const highlightedEdgeIds = useGraphStore(
    (s: GraphState) => s.highlightedEdgeIds,
  )
  const setHighlightedEdges = useGraphStore(
    (s: GraphState) => s.setHighlightedEdges,
  )
  const relationDraft = useGraphStore((s: GraphState) => s.relationDraft)
  const toggleRelationParticipant = useGraphStore(
    (s: GraphState) => s.toggleRelationParticipant,
  )

  const [pathStartId, setPathStartId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

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
  // point; several handlers need the *current* store values (full node
  // data, path-highlight state, relation-draft state) without forcing a
  // teardown/recreate of the WebGL scene on every change, so they're
  // mirrored into refs and read from there instead of the closure.
  const nodesRef = useRef<Node[]>(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef<Edge[]>(edges)
  edgesRef.current = edges
  const pathStartIdRef = useRef<string | null>(pathStartId)
  pathStartIdRef.current = pathStartId
  const relationDraftRef = useRef(relationDraft)
  relationDraftRef.current = relationDraft
  // Adjacency built alongside graphData in the data effect below, read
  // by onNodeHover in the mount effect. A ref (not state) because hover
  // firing on every mouse-move must never trigger a React re-render.
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map())

  const focusNode = useCallback((nodeId: string) => {
    const graph = graphRef.current
    if (!graph) return
    const target = (graph.graphData().nodes as Graph3DNode[]).find(
      (n) => n.id === nodeId,
    )
    if (!target) return
    const distance = 120
    const distRatio =
      1 + distance / Math.hypot(target.x ?? 1, target.y ?? 1, target.z ?? 1)
    graph.cameraPosition(
      {
        x: (target.x ?? 0) * distRatio,
        y: (target.y ?? 0) * distRatio,
        z: (target.z ?? 0) * distRatio,
      },
      { x: target.x ?? 0, y: target.y ?? 0, z: target.z ?? 0 },
      800,
    )
  }, [])

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

        const participantIndex = relationDraftRef.current.active
          ? relationDraftRef.current.participantIds.indexOf(n.id)
          : -1

        if (USE_CARD_NODES) {
          // Flat, always-camera-facing card -- replaces the old
          // sphere-plus-floating-label combo (see below) so a dense
          // graph reads as readable name-tags instead of merged dots
          // with text hanging in space. onNodeHover finds this sprite
          // via userData.isCard to redraw it on hover and to dim it
          // when a *different* node is hovered.
          const card = buildNodeCardSprite(
            n.name,
            nodeTypeIcon(n.cksType),
            n.color,
            false,
            n.degree,
          )
          group.add(card)

          const cardWidthPx = card.userData.widthPx as number
          const cardHeightPx = card.userData.heightPx as number
          const cardHalfHeight = (cardHeightPx * CARD_WORLD_SCALE) / 2
          if (participantIndex !== -1) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(
                cardHalfHeight * 1.3,
                cardHalfHeight * 1.5,
                24,
              ),
              new THREE.MeshBasicMaterial({
                color: '#fbbf24',
                side: THREE.DoubleSide,
                transparent: true,
              }),
            )
            ring.position.set(0, 0, 0.1)
            group.add(ring)
            const badge = new SpriteText(String(participantIndex + 1))
            badge.color = '#0f172a'
            badge.backgroundColor = '#fbbf24'
            badge.textHeight = 2.6
            badge.padding = 1
            badge.borderRadius = 6
            badge.position.set(
              cardWidthPx * CARD_WORLD_SCALE * 0.42,
              cardHalfHeight,
              0.2,
            )
            group.add(badge)
          }

          return group
        }

        // --- Fallback: original sphere + floating SpriteText label. ---
        // Kept working (not deleted) behind USE_CARD_NODES so the card
        // rendering above can be toggled off without reverting this
        // file, per the task's "don't remove the old sphere code"
        // constraint.
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

        // relation-draft: a thin ring showing which participant slot
        // (1st/2nd) this node occupies, matching CksNode's badge in 2D.
        if (participantIndex !== -1) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius + 1.8, 0.5, 8, 32),
            new THREE.MeshBasicMaterial({ color: '#fbbf24' }),
          )
          group.add(ring)
          const badge = new SpriteText(String(participantIndex + 1))
          badge.color = '#0f172a'
          badge.backgroundColor = '#fbbf24'
          badge.textHeight = 2.6
          badge.padding = 1
          badge.borderRadius = 6
          badge.position.set(radius * 0.7, radius * 0.7, 0)
          group.add(badge)
        }

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
      .linkColor((link) =>
        highlightedEdgeIdsRef.current.has((link as Graph3DLink).id)
          ? '#22d3ee'
          : 'rgba(148, 163, 184, 0.55)',
      )
      .linkWidth((link) =>
        highlightedEdgeIdsRef.current.has((link as Graph3DLink).id) ? 2.5 : 0.6,
      )
      .linkOpacity(0.6)
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
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
          const isHoveredNode = hoveredId !== null && gn.id === hoveredId

          const card = gn.__threeObj?.children.find(
            (c): c is THREE.Sprite =>
              c instanceof THREE.Sprite && c.userData.isCard === true,
          )
          if (card) {
            // The hovered card itself gets redrawn with the brighter
            // background + outline treatment (see drawNodeCardCanvas);
            // everything else just fades via material opacity, same as
            // the old dim-non-neighbors behavior.
            const material = card.material as THREE.SpriteMaterial
            const texture = material.map as THREE.CanvasTexture | null
            const cardWidthPx =
              (card.userData.widthPx as number) ?? CARD_WIDTH_PX
            const cardHeightPx =
              (card.userData.heightPx as number) ?? CARD_HEIGHT_PX
            if (texture && isHoveredNode !== (card.userData.hovered ?? false)) {
              const canvas = drawNodeCardCanvas(
                gn.name,
                nodeTypeIcon(gn.cksType),
                gn.color,
                isHoveredNode,
                cardWidthPx,
                cardHeightPx,
                (card.userData.degree as number) ?? gn.degree,
              )
              texture.image = canvas
              texture.needsUpdate = true
              card.userData.hovered = isHoveredNode
            }
            material.opacity = dim ? 0.2 : 1
            const scale = isHoveredNode ? 1.08 : 1
            card.scale.set(
              cardWidthPx * CARD_WORLD_SCALE * scale,
              cardHeightPx * CARD_WORLD_SCALE * scale,
              1,
            )
          }

          // Fallback path (USE_CARD_NODES = false): dim the sphere +
          // label the same way the card branch above dims the card.
          const sphere = gn.__threeObj?.children.find(
            (c): c is THREE.Mesh => c instanceof THREE.Mesh,
          )
          const sphereMaterial = sphere?.material as
            | THREE.MeshLambertMaterial
            | undefined
          if (sphereMaterial) sphereMaterial.opacity = dim ? 0.15 : 0.92
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
          const isPathHighlighted = highlightedEdgeIdsRef.current.has(gl.id)
          const lineMaterial = (
            gl.__lineObj as unknown as THREE.Line | undefined
          )?.material as THREE.LineBasicMaterial | undefined
          if (lineMaterial) {
            lineMaterial.transparent = true
            lineMaterial.opacity =
              hoveredId === null
                ? isPathHighlighted
                  ? 0.95
                  : 0.6
                : touches
                  ? 0.9
                  : 0.06
          }
        }

        if (containerRef.current) {
          containerRef.current.style.cursor = hoveredId ? 'pointer' : 'default'
        }
      })
      .onNodeClick((node, event) => {
        const n = node as Graph3DNode

        // Relation-draft mode (creating a new relation, started from
        // GraphPage's "New relation" button): click picks/unpicks this
        // node as a participant instead of selecting/navigating.
        if (relationDraftRef.current.active && !event.shiftKey) {
          toggleRelationParticipant(n.id)
          return
        }

        // Shift+click twice: highlight the shortest path between the
        // two clicked nodes, same as GraphCanvas's Shift+click.
        if (event.shiftKey) {
          if (!pathStartIdRef.current) {
            setPathStartId(n.id)
            return
          }
          const path = findPathBetweenNodes3D(
            pathStartIdRef.current,
            n.id,
            edgesRef.current,
          )
          setHighlightedEdges(path)
          setPathStartId(null)
          return
        }

        selectNode(n.id)
        const fullNode = nodesRef.current.find((rn) => rn.id === n.id)
        if (fullNode) onNodeSelect?.(fullNode)
        // Recenter the camera on the clicked node, same distance out, so
        // clicking through a cluster feels like navigating rather than
        // just re-coloring a dot buried in the point cloud.
        focusNode(n.id)
      })
      .onBackgroundClick(() => {
        selectNode(null)
        setPathStartId(null)
      })

    // Component-containment clustering: softly pulls Tools/ADRs/etc.
    // toward their owning Component/Module's centroid so the graph
    // visually separates into per-repo/per-module sub-clusters instead
    // of one undifferentiated cloud. See makeClusterForce's doc comment.
    graph.d3Force(
      'cluster',
      makeClusterForce(() => graph.graphData().nodes as Graph3DNode[]),
    )

    // Ground grid + origin axes purely for spatial orientation while
    // orbiting/panning a graph with no other fixed reference points --
    // low-opacity so it recedes behind the actual data.
    const scene = graph.scene()
    const grid = new THREE.GridHelper(500, 25, 0x475569, 0x1e293b)
    grid.position.y = -180
    for (const mat of Array.isArray(grid.material)
      ? grid.material
      : [grid.material]) {
      mat.transparent = true
      mat.opacity = 0.18
    }
    scene.add(grid)
    const axes = new THREE.AxesHelper(50)
    scene.add(axes)

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
    // Deliberately excludes highlightedEdgeIds/relationDraft/pathStartId:
    // those are read from refs (see highlightedEdgeIdsRef below and the
    // *Ref mirrors above) so changing them re-colors/re-picks in place
    // without tearing down and rebuilding the WebGL scene.
  }, [
    onNodeSelect,
    selectNode,
    setHighlightedEdges,
    toggleRelationParticipant,
    focusNode,
  ])

  // highlightedEdgeIds needs to be readable from inside the mount
  // effect's closures (linkColor/linkWidth/hover) without re-running
  // that effect on every highlight change -- mirrored into a ref here,
  // then the link accessors are force-refreshed below.
  const highlightedEdgeIdsRef = useRef(highlightedEdgeIds)
  highlightedEdgeIdsRef.current = highlightedEdgeIds
  // biome-ignore lint/correctness/useExhaustiveDependencies: highlightedEdgeIds is read via the ref above inside linkColor/linkWidth closures; it's listed here purely to re-trigger the refresh call below when it changes.
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    // Re-invoking an accessor with itself is 3d-force-graph's documented
    // way to force it to re-evaluate that accessor for all existing
    // links without a full graphData() swap (which would also restart
    // the simulation/camera).
    graph.linkColor(graph.linkColor())
    graph.linkWidth(graph.linkWidth())
  }, [highlightedEdgeIds])

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
        id: edge.id,
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

    const clusterOf = computeClusters(visibleNodes, edges)

    const graph3DNodes: Graph3DNode[] = visibleNodes.map((node) => {
      const cksType = (node.data?.cksType as string) || 'Concept'
      return {
        id: node.id,
        name: (node.data?.label as string) || node.id,
        cksType,
        color: nodeTypeColor(cksType),
        degree: degree.get(node.id) ?? 0,
        cluster: clusterOf.get(node.id),
      }
    })

    graph.graphData({ nodes: graph3DNodes, links: graph3DLinks })
  }, [nodes, edges, hiddenTypes])

  // Re-render node visuals (participant rings) when relation-draft
  // selection changes -- nodeThreeObject only re-runs per node when
  // graphData is swapped, so force a refresh the same way link color
  // does above.
  // biome-ignore lint/correctness/useExhaustiveDependencies: relationDraft is read via relationDraftRef inside nodeThreeObject's closure; listed here purely to re-trigger the refresh call below when it changes.
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    graph.nodeThreeObject(graph.nodeThreeObject())
  }, [relationDraft])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragOver(false)
      setDropError(null)

      const file = event.dataTransfer.files?.[0]
      if (!file) return
      if (!file.name.endsWith('.json')) {
        setDropError('Expected a .json file with a subgraph (nodes/edges).')
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(String(reader.result))
          if (!looksLikeSubgraphResult(parsed)) {
            setDropError(
              "File doesn't look like a query_subgraph export ({nodes, edges}). " +
                'A full .cks.json ({objects: [...]}) needs to be imported via ' +
                'scripts/import-ecosystem-graph.py — that requires creating a session on the server.',
            )
            return
          }
          const { nodes: newNodes, edges: newEdges } = cksToReactFlow(
            parsed as SubgraphResult,
          )
          setNodes(newNodes)
          setEdges(newEdges)
        } catch {
          setDropError('Could not parse JSON.')
        }
      }
      reader.readAsText(file)
    },
    [setNodes, setEdges],
  )

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      role="application"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {nodes.length > 0 && (
        <div className="absolute top-3 left-3 z-10">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-1.5 bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary shadow-lg transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Search nodes
            <kbd className="font-mono text-[10px] text-text-tertiary border border-border-subtle rounded px-1">
              ⌘K
            </kbd>
          </button>
        </div>
      )}
      <GraphSearchPalette3D
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onFocusNode={focusNode}
      />

      {pathStartId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-900/90 border border-amber-700 text-amber-100 text-xs rounded px-3 py-1.5">
          Shift+click a second node to highlight the path to it
        </div>
      )}

      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-accent/10 border-2 border-dashed border-accent pointer-events-none">
          <p className="text-sm text-text-primary bg-surface-1/95 px-4 py-2 rounded-md shadow-lg">
            Drop a subgraph .json file
          </p>
        </div>
      )}
      {dropError && (
        <div className="absolute bottom-16 left-3 z-10 bg-danger/90 text-white text-xs rounded px-3 py-1.5 max-w-sm">
          {dropError}
          <button
            type="button"
            onClick={() => setDropError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {nodes.length === 0 && !isLoading && <GraphEmptyState />}
      {isLoading && nodes.length === 0 && <GraphSkeleton />}
    </div>
  )
}

/** Same BFS shortest-path-by-edge-count as graphUtils' findPathBetweenNodes,
 *  duplicated here because that one is typed against @xyflow/react's Edge
 *  (edge.source/target as plain node id strings), which our Edge[] here
 *  also happens to be -- but keeping a local copy avoids coupling this
 *  file's path logic to 2D-specific imports/behavior if the two ever
 *  need to diverge (e.g. weighting by 3D distance). */
function findPathBetweenNodes3D(
  fromId: string,
  toId: string,
  edges: Edge[],
): Set<string> {
  if (fromId === toId) return new Set()

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
  const cameFrom = new Map<string, { edgeId: string; prevId: string }>()
  const queue: string[] = [fromId]

  while (queue.length > 0) {
    const current = queue.shift() as string
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
