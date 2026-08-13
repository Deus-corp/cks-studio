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
import { FullscreenIcon } from '@/components/graph/FullscreenIcon'
import { GraphEmptyState } from '@/components/graph/GraphEmptyState'
import { GraphSearchPalette3D } from '@/components/graph/GraphSearchPalette3D'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'
import type { GraphState } from '@/features/graph-explorer/graphExplorerStore'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { nodeTypeColor, nodeTypeIcon } from '@/shared/constants/nodeTypes'
import { useFullscreen } from '@/shared/hooks/useFullscreen'
import { useThemeStore } from '@/shared/stores/themeStore'
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
  // Pinning a node's position for the d3 simulation: d3-force(-3d)
  // treats a node with fx/fy/fz set as fixed and skips it entirely when
  // integrating velocity, which is how focus mode (see enterFocus)
  // "stabilizes" the selected node and its neighbors in place. Cleared
  // (set back to undefined) on exitFocus to release the node back into
  // the normal simulation.
  fx?: number
  fy?: number
  fz?: number
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

/** Card colors per theme, mirroring the same design tokens the 2D
 *  CksNode/CSS use (see styles/index.css's `[data-theme="light"]` block
 *  for `--color-surface-1/2` and `--color-text-primary`). Drawn onto an
 *  offscreen canvas rather than read live from CSS custom properties --
 *  computed-style lookups inside a hot per-node draw path would be far
 *  slower than a plain object lookup, and these two themes are the only
 *  ones the store supports (see themeStore.ts). */
export const CARD_THEME_COLORS = {
  dark: {
    background: '#1b212c',
    backgroundHovered: '#242b38',
    text: '#e5e7eb',
    badgeBg: 'rgba(15, 23, 42, 0.72)',
    badgeText: '#94a3b8',
  },
  light: {
    // Was '#ffffff' -- CksNode/2D actually uses --color-surface-3
    // (#e5e7ec), not pure white (see CksNode.tsx: "surface-2 sits too
    // close to the page background... use surface-3"). The 3D canvas
    // background is --color-surface-0 (#f5f4f0), so a white card had
    // almost no contrast against it and read as washed-out/transparent
    // even though the card itself is fully opaque. Matching 2D's
    // surface-3 here fixes that without changing anything about opacity
    // (background/backgroundHovered are always drawn as solid fills,
    // never with alpha -- see drawNodeCardCanvas below).
    background: '#e5e7ec',
    backgroundHovered: '#eef0f4',
    text: '#16181d',
    badgeBg: 'rgba(203, 208, 217, 0.9)',
    badgeText: '#404550',
  },
} as const

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
export function drawNodeCardCanvas(
  name: string,
  icon: string,
  accentColor: string,
  hovered: boolean,
  width: number = CARD_WIDTH_PX,
  height: number = CARD_HEIGHT_PX,
  degree = 0,
  theme: 'dark' | 'light' = 'dark',
): HTMLCanvasElement {
  const palette = CARD_THEME_COLORS[theme]
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
  ctx.fillStyle = hovered ? palette.backgroundHovered : palette.background
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

  ctx.fillStyle = palette.text
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
    ctx.fillStyle = palette.badgeBg
    ctx.fill()

    ctx.fillStyle = palette.badgeText
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
  theme: 'dark' | 'light' = 'dark',
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
    theme,
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

/** Frees the GPU-side resources (geometries, materials, and any
 *  CanvasTexture maps) owned by a node's three.js object tree. Needed
 *  before every `nodeThreeObject(nodeThreeObject())` re-invoke
 *  (enterFocus/exitFocus/relationDraft below) -- that's 3d-force-graph's
 *  documented way to force nodeThreeObject to re-run for every node, but
 *  it just discards the *old* group in favor of the newly-built one
 *  without disposing it. Three.js doesn't garbage-collect GPU resources
 *  on its own (only the JS-side objects get GC'd), so every focus-mode
 *  toggle or relation-draft click was silently leaking one texture +
 *  material per node -- the actual cause of the graph progressively
 *  lagging the longer a session runs, independent of theme. Called once
 *  per node right before the rebuild, walking every child (card sprite,
 *  focus/participant/multi-select rings) rather than assuming a fixed
 *  shape, so it stays correct if more decorations are added later. */
export function disposeNodeObject3D(obj: THREE.Object3D | undefined): void {
  if (!obj) return
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh | THREE.Sprite
    const geometry = (mesh as THREE.Mesh).geometry as
      | THREE.BufferGeometry
      | undefined
    geometry?.dispose()
    const material = mesh.material as
      | THREE.Material
      | THREE.Material[]
      | undefined
    const materials = Array.isArray(material)
      ? material
      : material
        ? [material]
        : []
    for (const mat of materials) {
      const map = (mat as THREE.SpriteMaterial | THREE.MeshBasicMaterial).map
      map?.dispose()
      mat.dispose()
    }
  })
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

/** Click-to-focus state: which node was clicked (`primaryId`), the set
 *  of node ids that should stay pinned/highlighted (the clicked node
 *  plus its direct neighbors), and the centroid those nodes occupied at
 *  the moment focus was entered -- used as the point non-focus nodes
 *  get pushed away from (see makeFocusRepelForce) so the repulsion
 *  direction doesn't need recomputing every tick. */
interface FocusState {
  active: boolean
  primaryId: string | null
  focusIds: Set<string>
  centroid: { x: number; y: number; z: number }
}

const INITIAL_FOCUS_STATE: FocusState = {
  active: false,
  primaryId: null,
  focusIds: new Set(),
  centroid: { x: 0, y: 0, z: 0 },
}

/** Custom d3-force that, while focus mode is active, gently pushes every
 *  *non*-focus node away from the focused cluster's centroid (radially,
 *  scaled by alpha like any other d3-force). Focus/neighbor nodes don't
 *  need an equivalent pull -- they're pinned in place via fx/fy/fz by
 *  enterFocus, so d3-force already skips them when integrating.
 *  Reads live state through the ref so it keeps working across
 *  graphData() swaps without needing to be re-registered. */
function makeFocusRepelForce(
  getNodes: () => Graph3DNode[],
  focusStateRef: { current: FocusState },
) {
  const strength = 6
  return (alpha: number) => {
    const state = focusStateRef.current
    if (!state.active) return
    for (const n of getNodes()) {
      if (state.focusIds.has(n.id)) continue
      const dx = (n.x ?? 0) - state.centroid.x
      const dy = (n.y ?? 0) - state.centroid.y
      const dz = (n.z ?? 0) - state.centroid.z
      const dist = Math.hypot(dx, dy, dz) || 1
      const push = strength * alpha
      n.vx = (n.vx ?? 0) + (dx / dist) * push
      n.vy = (n.vy ?? 0) + (dy / dist) * push
      n.vz = (n.vz ?? 0) + (dz / dist) * push
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
  const multiSelectedIds = useGraphStore((s: GraphState) => s.multiSelectedIds)
  const toggleMultiSelect = useGraphStore(
    (s: GraphState) => s.toggleMultiSelect,
  )
  const setMultiSelect = useGraphStore((s: GraphState) => s.setMultiSelect)
  const clearMultiSelect = useGraphStore((s: GraphState) => s.clearMultiSelect)

  const [pathStartId, setPathStartId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

  // Fullscreen target is the outer wrapper (see the returned JSX below),
  // not the three.js mount div itself -- same reasoning as GraphCanvas:
  // keeps overlays (search button, focus banner, drag/drop toast) visible
  // while fullscreen instead of only the raw WebGL canvas.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(wrapperRef)

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
  // Ctrl/Cmd+click multi-select (Start Pipeline) -- same ref-mirror
  // pattern as relationDraftRef above, read inside nodeThreeObject's
  // closure and onNodeClick without forcing a scene teardown.
  const multiSelectedRef = useRef(multiSelectedIds)
  multiSelectedRef.current = multiSelectedIds
  // Current theme, read the same ref-mirror way as the other closures
  // above so nodeThreeObject/applyNodeVisualState can pick light vs dark
  // card colors (see CARD_THEME_COLORS) without the mount effect
  // depending on theme and tearing down the WebGL scene on toggle.
  const theme = useThemeStore((s) => s.theme)
  const themeRef = useRef(theme)
  themeRef.current = theme
  // Adjacency built alongside graphData in the data effect below, read
  // by onNodeHover in the mount effect. A ref (not state) because hover
  // firing on every mouse-move must never trigger a React re-render.
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map())
  // Click-to-focus state (Task 2 in the graph-view improvements): which
  // node is focused, its neighbor set, and their centroid at focus-time.
  // A ref (not state) so makeFocusRepelForce and onNodeClick's closures
  // read the latest value every simulation tick / click without forcing
  // a WebGL scene teardown -- same pattern as the other *Ref mirrors
  // above.
  const focusStateRef = useRef<FocusState>(INITIAL_FOCUS_STATE)
  // Set inside the mount effect to the current applyNodeVisualState
  // closure (see there) -- lets enterFocus/exitFocus immediately
  // refresh dimming/opacity without duplicating that logic or waiting
  // for the next hover event.
  const dimRefreshRef = useRef<((hoveredId: string | null) => void) | null>(
    null,
  )
  // Set inside the mount effect to a function that redraws every
  // existing card's THREE.CanvasTexture in place with the current
  // theme's colors (see CARD_THEME_COLORS) -- lets the theme-toggle
  // effect below update colors without rebuilding/replacing any
  // sprites, materials, or textures (see that effect's comment for why
  // that matters).
  const themeRefreshRef = useRef<(() => void) | null>(null)
  // Mirrors focusStateRef.current.active into React state purely so the
  // "exit focus" affordance in the toolbar can re-render; the ref
  // remains the source of truth read by simulation/click code.
  const [isFocusActive, setIsFocusActive] = useState(false)
  // Whether focus mode is armed at all (the "Focus" toggle button in the
  // top-right toolbar, next to fullscreen). Focus mode used to activate
  // automatically on every node click; now clicking a node only pins +
  // isolates its neighborhood when this is on -- otherwise a click just
  // selects the node and moves the camera toward it (the old plain
  // focusNode behavior). A ref mirror so onNodeClick's closure (captured
  // once in the mount effect) always reads the latest value.
  const [isFocusModeEnabled, setIsFocusModeEnabled] = useState(false)
  const isFocusModeEnabledRef = useRef(isFocusModeEnabled)
  isFocusModeEnabledRef.current = isFocusModeEnabled

  /** Pin the clicked node + its direct neighbors in place (fx/fy/fz) so
   *  they read as a stable, static figure, release any previously
   *  focused nodes back into the simulation, and reheat so the
   *  focus-repel force (registered at mount) pushes everything else
   *  aside. Visuals (focus ring, non-focus dimming) are refreshed by
   *  re-invoking nodeThreeObject/onNodeHover's dimming pass below. */
  const enterFocus = useCallback((nodeId: string) => {
    const graph = graphRef.current
    if (!graph) return
    const { nodes: currentNodes } = graph.graphData() as {
      nodes: Graph3DNode[]
    }
    const neighborIds = neighborsRef.current.get(nodeId) ?? new Set<string>()
    const focusIds = new Set<string>([nodeId, ...neighborIds])

    let cx = 0
    let cy = 0
    let cz = 0
    let count = 0
    for (const gn of currentNodes) {
      if (focusIds.has(gn.id)) {
        // Pin at the node's current simulated position -- freezing it
        // where it already is (rather than snapping elsewhere) is what
        // makes the transition read as "this cluster held still while
        // everything else moved away" instead of a jump-cut.
        gn.fx = gn.x
        gn.fy = gn.y
        gn.fz = gn.z
        cx += gn.x ?? 0
        cy += gn.y ?? 0
        cz += gn.z ?? 0
        count += 1
      } else if (
        gn.fx !== undefined ||
        gn.fy !== undefined ||
        gn.fz !== undefined
      ) {
        // Release anything pinned by a previous focus that isn't part
        // of this one.
        gn.fx = undefined
        gn.fy = undefined
        gn.fz = undefined
      }
    }

    focusStateRef.current = {
      active: true,
      primaryId: nodeId,
      focusIds,
      centroid:
        count > 0
          ? { x: cx / count, y: cy / count, z: cz / count }
          : { x: 0, y: 0, z: 0 },
    }
    setIsFocusActive(true)
    // Re-invoking nodeThreeObject with itself is 3d-force-graph's
    // documented way to force every node's three.js object to be
    // rebuilt (same trick used for relationDraft above) -- needed here
    // so the focus ring (added in nodeThreeObject below) appears
    // immediately rather than on the next unrelated re-render. Dispose
    // the outgoing objects first (see disposeNodeObject3D) since the
    // library itself doesn't -- without this, every focus-mode toggle
    // leaked a texture+material per node.
    for (const gn of currentNodes) disposeNodeObject3D(gn.__threeObj)
    graph.nodeThreeObject(graph.nodeThreeObject())
    dimRefreshRef.current?.(null)
    graph.d3ReheatSimulation()
    // Deliberately no camera movement here -- an earlier version called
    // zoomToFit to auto-frame the cluster, but that produced a jarring
    // zoom-out every time focus mode was entered. The camera now stays
    // exactly where the person left it; frameFocusedCluster (wired to
    // the "Frame cluster" button in the focus banner) does the same
    // framing on demand instead.
  }, [])

  /** On-demand camera framing for the current focus cluster -- called
   *  from the "Frame cluster" button in the focus banner (see render
   *  below). Kept separate from enterFocus so entering focus mode never
   *  moves the camera on its own (see the comment in enterFocus); this
   *  gives the same "see the whole isolated neighborhood at once"
   *  capability but only when the person explicitly asks for it. */
  const frameFocusedCluster = useCallback(() => {
    const graph = graphRef.current
    const focus = focusStateRef.current
    if (!graph || !focus.active) return
    graph.zoomToFit(700, 80, (gn) => focus.focusIds.has(gn.id))
  }, [])

  /** Release all pinned nodes and clear focus state, restoring normal
   *  force-directed behavior. Safe to call even if focus isn't active. */
  const exitFocus = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const { nodes: currentNodes } = graph.graphData() as {
      nodes: Graph3DNode[]
    }
    for (const gn of currentNodes) {
      gn.fx = undefined
      gn.fy = undefined
      gn.fz = undefined
    }
    focusStateRef.current = INITIAL_FOCUS_STATE
    setIsFocusActive(false)
    // See enterFocus's comment -- dispose before rebuilding.
    for (const gn of currentNodes) disposeNodeObject3D(gn.__threeObj)
    graph.nodeThreeObject(graph.nodeThreeObject())
    dimRefreshRef.current?.(null)
    graph.d3ReheatSimulation()
  }, [])

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

    /** Dims non-relevant nodes/links and (un)highlights the hovered one.
     *  Relevance is hover-driven when something is hovered (unchanged
     *  from the original behavior); when nothing is hovered but focus
     *  mode is active, non-focus nodes/links stay dimmed instead of
     *  resetting to full opacity, so "everything but the focused
     *  cluster" reads as backgrounded the whole time focus is on, not
     *  just transiently on hover. Called both from onNodeHover (with
     *  the live hovered id) and from enterFocus/exitFocus (with null,
     *  i.e. "as if nothing were hovered") via dimRefreshRef so toggling
     *  focus mode updates opacities immediately rather than waiting for
     *  the next mouse-move. */
    const applyNodeVisualState = (hoveredId: string | null) => {
      const neighborIds = hoveredId
        ? (neighborsRef.current.get(hoveredId) ?? new Set())
        : null
      const focus = focusStateRef.current
      const { nodes: currentNodes, links: currentLinks } = graph.graphData()

      for (const gn of currentNodes as Graph3DNode[]) {
        const dim =
          hoveredId !== null
            ? gn.id !== hoveredId && !neighborIds?.has(gn.id)
            : focus.active && !focus.focusIds.has(gn.id)
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
          const cardWidthPx = (card.userData.widthPx as number) ?? CARD_WIDTH_PX
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
              themeRef.current,
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
        const focusTouches =
          hoveredId === null &&
          focus.active &&
          (focus.focusIds.has(sourceId) || focus.focusIds.has(targetId))
        const isPathHighlighted = highlightedEdgeIdsRef.current.has(gl.id)
        const lineMaterial = (gl.__lineObj as unknown as THREE.Line | undefined)
          ?.material as THREE.LineBasicMaterial | undefined
        if (lineMaterial) {
          lineMaterial.transparent = true
          lineMaterial.opacity =
            hoveredId === null
              ? focus.active
                ? focusTouches
                  ? 0.9
                  : 0.06
                : isPathHighlighted
                  ? 0.95
                  : 0.6
              : touches
                ? 0.9
                : 0.06
        }
      }
    }
    dimRefreshRef.current = applyNodeVisualState

    /** Redraws every existing card's canvas texture in place with the
     *  current theme's colors, without creating any new THREE.Sprite,
     *  SpriteMaterial, or CanvasTexture -- unlike the
     *  `nodeThreeObject(nodeThreeObject())` re-invoke trick used
     *  elsewhere in this file (enterFocus/exitFocus/relationDraft/
     *  multi-select), which replaces every node's three.js object and
     *  leaves the old sprite/material/texture for the GC to (eventually,
     *  maybe never, on some drivers) reclaim. Doing that on every theme
     *  toggle was the source of the progressive slowdown -- repeated
     *  toggling piled up orphaned GPU textures until a reload cleared
     *  them. Reusing the same texture and just swapping its backing
     *  canvas + flagging needsUpdate re-uploads the same GL texture
     *  object instead of allocating a new one. */
    const refreshCardTextures = () => {
      const g = graphRef.current
      if (!g) return
      const { nodes: currentNodes } = g.graphData() as {
        nodes: Graph3DNode[]
      }
      for (const gn of currentNodes) {
        const card = gn.__threeObj?.children.find(
          (c): c is THREE.Sprite =>
            c instanceof THREE.Sprite && c.userData.isCard === true,
        )
        if (!card) continue
        const material = card.material as THREE.SpriteMaterial
        const texture = material.map as THREE.CanvasTexture | null
        if (!texture) continue
        const cardWidthPx = (card.userData.widthPx as number) ?? CARD_WIDTH_PX
        const cardHeightPx =
          (card.userData.heightPx as number) ?? CARD_HEIGHT_PX
        const canvas = drawNodeCardCanvas(
          gn.name,
          nodeTypeIcon(gn.cksType),
          gn.color,
          Boolean(card.userData.hovered),
          cardWidthPx,
          cardHeightPx,
          (card.userData.degree as number) ?? gn.degree,
          themeRef.current,
        )
        texture.image = canvas
        texture.needsUpdate = true
      }
    }
    themeRefreshRef.current = refreshCardTextures

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
            themeRef.current,
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

          // Focus-mode visual cue: a ring around the clicked node
          // (brighter) and its direct neighbors (dimmer), so the
          // isolated cluster reads clearly against the nodes drifting
          // away in the background. Drawn as a flat ring rather than
          // reusing the participant ring above since both can't be
          // active on the same node at once in practice (relation-draft
          // and focus mode are separate interactions) but are kept
          // visually distinct just in case.
          const focus = focusStateRef.current
          if (focus.active && focus.focusIds.has(n.id)) {
            const isPrimary = focus.primaryId === n.id
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(
                cardHalfHeight * 1.35,
                cardHalfHeight * (isPrimary ? 1.62 : 1.5),
                32,
              ),
              new THREE.MeshBasicMaterial({
                color: isPrimary ? '#22d3ee' : '#67e8f9',
                side: THREE.DoubleSide,
                transparent: true,
                opacity: isPrimary ? 0.95 : 0.65,
              }),
            )
            ring.position.set(0, 0, -0.1)
            group.add(ring)
          }

          // Pipeline multi-select ring -- teal, distinct from both the
          // amber relation-draft ring and the cyan focus ring above so
          // all three read unambiguously if they ever overlap on the
          // same node.
          if (multiSelectedRef.current.has(n.id)) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(
                cardHalfHeight * 1.2,
                cardHalfHeight * 1.32,
                24,
              ),
              new THREE.MeshBasicMaterial({
                color: '#2dd4bf',
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9,
              }),
            )
            ring.position.set(0, 0, 0.05)
            group.add(ring)
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
        applyNodeVisualState(hoveredId)
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

        // Ctrl/Cmd+click toggles this node in the pipeline multi-select
        // set without changing focus mode -- lets you build up a
        // selection across the cluster you're currently focused on
        // instead of every click re-targeting focus.
        if (event.ctrlKey || event.metaKey) {
          toggleMultiSelect(n.id)
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
        setMultiSelect([n.id])
        const fullNode = nodesRef.current.find((rn) => rn.id === n.id)
        if (fullNode) onNodeSelect?.(fullNode)

        // Focus mode is opt-in via the toolbar toggle (see
        // isFocusModeEnabledRef) -- when it's off, a click just selects
        // the node and moves the camera toward it, same as before focus
        // mode existed. When it's on, clicking behaves as before:
        // clicking the already-focused node exits focus (reversible);
        // clicking any other node enters/re-targets focus onto it,
        // pinning it + its direct neighbors and pushing the rest of the
        // graph aside (see enterFocus/exitFocus and makeFocusRepelForce
        // above).
        if (!isFocusModeEnabledRef.current) {
          if (focusStateRef.current.active) exitFocus()
          focusNode(n.id)
          return
        }

        const wasFocusedOnThisNode =
          focusStateRef.current.active &&
          focusStateRef.current.primaryId === n.id
        if (wasFocusedOnThisNode) {
          exitFocus()
        } else {
          enterFocus(n.id)
        }
        // Recenter the camera on the clicked node, same distance out, so
        // clicking through a cluster feels like navigating rather than
        // just re-coloring a dot buried in the point cloud. Skipped when
        // entering focus mode -- enterFocus already frames the whole
        // focused cluster via zoomToFit, and running both would fight
        // over the camera.
        if (wasFocusedOnThisNode) focusNode(n.id)
      })
      .onBackgroundClick(() => {
        selectNode(null)
        setPathStartId(null)
        clearMultiSelect()
        exitFocus()
      })

    // Component-containment clustering: softly pulls Tools/ADRs/etc.
    // toward their owning Component/Module's centroid so the graph
    // visually separates into per-repo/per-module sub-clusters instead
    // of one undifferentiated cloud. See makeClusterForce's doc comment.
    graph.d3Force(
      'cluster',
      makeClusterForce(() => graph.graphData().nodes as Graph3DNode[]),
    )

    // Roughly double the default node spacing (d3-force-3d's built-in
    // 'link'/'charge' forces default to distance 30 / strength -30) so
    // the graph reads as less compressed without spreading so far that
    // the cluster/focus forces above lose their pull. Both need
    // adjusting together -- link distance alone just stretches direct
    // edges, while charge alone only pushes unconnected nodes apart.
    graph.d3Force('link')?.distance(60)
    graph.d3Force('charge')?.strength(-60)

    // Focus-mode repulsion: pushes non-focus nodes away from the
    // focused cluster's centroid while the focus/neighbor nodes stay
    // pinned via fx/fy/fz (see enterFocus/exitFocus below). No-op when
    // focus mode isn't active.
    graph.d3Force(
      'focusRepel',
      makeFocusRepelForce(
        () => graph.graphData().nodes as Graph3DNode[],
        focusStateRef,
      ),
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

    // Small X/Y/Z labels at the tip of each axis -- the bare AxesHelper
    // above (red/green/blue lines) tells you the three directions exist
    // but not which is which once you've orbited away from the default
    // view. Cheap orientation aid in lieu of porting the 2D minimap
    // (see the file-level doc comment's "not yet ported" list).
    const axisLabelSpecs: [string, string, [number, number, number]][] = [
      ['X', '#f87171', [56, 0, 0]],
      ['Y', '#4ade80', [0, 56, 0]],
      ['Z', '#60a5fa', [0, 0, 56]],
    ]
    for (const [text, color, position] of axisLabelSpecs) {
      const label = new SpriteText(text)
      label.color = color
      label.textHeight = 3
      label.position.set(...position)
      scene.add(label)
    }

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
    toggleMultiSelect,
    setMultiSelect,
    clearMultiSelect,
    focusNode,
    enterFocus,
    exitFocus,
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

    // A graphData() swap replaces every node object wholesale, so any
    // fx/fy/fz pinning and focusIds set from a prior focus mode would
    // otherwise point at now-discarded objects (silently doing nothing,
    // and leaving the focus-repel force pushing against a "focus" that
    // no longer exists in the data). Clear it defensively whenever the
    // underlying node/edge set or filter changes.
    if (focusStateRef.current.active) exitFocus()
  }, [nodes, edges, hiddenTypes, exitFocus])

  // Re-render node visuals (participant rings) when relation-draft
  // selection changes -- nodeThreeObject only re-runs per node when
  // graphData is swapped, so force a refresh the same way link color
  // does above.
  // biome-ignore lint/correctness/useExhaustiveDependencies: relationDraft is read via relationDraftRef inside nodeThreeObject's closure; listed here purely to re-trigger the refresh call below when it changes.
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    // See enterFocus's comment on disposeNodeObject3D -- same rebuild
    // trick, same need to dispose the outgoing objects first.
    const { nodes: currentNodes } = graph.graphData() as {
      nodes: Graph3DNode[]
    }
    for (const gn of currentNodes) disposeNodeObject3D(gn.__threeObj)
    graph.nodeThreeObject(graph.nodeThreeObject())
  }, [relationDraft])

  // Multi-select ring updates used to call `graph.nodeThreeObject(graph
  // .nodeThreeObject())`, same as the relationDraft refresh above -- but
  // that re-invokes the per-node factory for *every* node in the graph,
  // which means redrawing the offscreen canvas + rebuilding the
  // CanvasTexture for every single card (an expensive synchronous
  // operation) just to add/remove a ring on the handful of nodes whose
  // selection state actually changed. Multi-select toggles happen on
  // every Ctrl/Cmd+click, so on a few-hundred-node graph this was the
  // main source of click-to-click lag. Instead, diff the previous and
  // next selection sets and mutate only the affected nodes' existing
  // __threeObj groups directly -- no texture redraws, no factory re-run.
  const prevMultiSelectedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    const prev = prevMultiSelectedRef.current
    const next = multiSelectedIds
    const changed = new Set<string>()
    for (const id of next) if (!prev.has(id)) changed.add(id)
    for (const id of prev) if (!next.has(id)) changed.add(id)
    prevMultiSelectedRef.current = new Set(next)
    if (changed.size === 0) return

    const { nodes: currentNodes } = graph.graphData() as {
      nodes: Graph3DNode[]
    }
    const RING_NAME = 'multiSelectRing'
    for (const gn of currentNodes) {
      if (!changed.has(gn.id)) continue
      const group = gn.__threeObj
      if (!group) continue
      const existingRing = group.children.find((c) => c.name === RING_NAME) as
        | THREE.Mesh
        | undefined

      if (next.has(gn.id)) {
        if (existingRing) continue
        const card = group.children.find(
          (c): c is THREE.Sprite =>
            c instanceof THREE.Sprite && c.userData.isCard === true,
        )
        const cardHeightPx =
          (card?.userData.heightPx as number) ?? CARD_HEIGHT_PX
        const cardHalfHeight = (cardHeightPx * CARD_WORLD_SCALE) / 2
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(
            cardHalfHeight * 1.2,
            cardHalfHeight * 1.32,
            24,
          ),
          new THREE.MeshBasicMaterial({
            color: '#2dd4bf',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
          }),
        )
        ring.name = RING_NAME
        ring.position.set(0, 0, 0.05)
        group.add(ring)
      } else if (existingRing) {
        group.remove(existingRing)
        existingRing.geometry.dispose()
        ;(existingRing.material as THREE.Material).dispose()
      }
    }
  }, [multiSelectedIds])

  // Refresh every card's texture colors when the theme toggles (Settings
  // -> Light/Dark/Auto) so 3D cards don't stay stuck with the other
  // theme's colors. Deliberately *not* the
  // `nodeThreeObject(nodeThreeObject())` re-invoke used elsewhere in
  // this file -- that replaces every node's three.js object (new
  // sprite/material/texture per node) without disposing the old ones,
  // which is exactly what caused theme toggling to progressively lag
  // the graph. refreshCardTextures instead updates each existing
  // texture's pixels in place, so repeated toggling stays cheap and
  // doesn't leak GPU memory.
  useEffect(() => {
    themeRefreshRef.current?.()
    dimRefreshRef.current?.(null)
  }, [])

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
      ref={wrapperRef}
      className="w-full h-full relative overflow-hidden"
      role="application"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = !isFocusModeEnabled
            setIsFocusModeEnabled(next)
            // Turning the toggle off while a focus is active should
            // release it immediately rather than leaving a pinned/dimmed
            // cluster on screen with no way to re-enter focus mode to
            // exit it.
            if (!next && focusStateRef.current.active) exitFocus()
          }}
          aria-pressed={isFocusModeEnabled}
          title={
            isFocusModeEnabled
              ? 'Focus mode on — click a node to isolate its neighborhood'
              : 'Focus mode off — click a node to select and center it'
          }
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium backdrop-blur-sm border shadow-lg transition-colors ${
            isFocusModeEnabled
              ? 'bg-cyan-950/90 border-cyan-800 text-cyan-100'
              : 'bg-surface-1/95 border-border-subtle text-text-secondary hover:text-text-primary hover:border-border'
          }`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M3 9V6a3 3 0 013-3h3M15 3h3a3 3 0 013 3v3M21 15v3a3 3 0 01-3 3h-3M9 21H6a3 3 0 01-3-3v-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Focus
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className="flex items-center justify-center bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md p-1.5 text-text-secondary hover:text-text-primary shadow-lg transition-colors"
        >
          <FullscreenIcon isFullscreen={isFullscreen} />
        </button>
      </div>

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

      {isFocusActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-cyan-950/90 border border-cyan-800 text-cyan-100 text-xs rounded px-3 py-1.5">
          Focused on node neighborhood
          <button
            type="button"
            onClick={frameFocusedCluster}
            className="underline hover:text-white"
            title="Move the camera to frame the focused node and its neighbors"
          >
            Frame cluster
          </button>
          <button
            type="button"
            onClick={exitFocus}
            className="underline hover:text-white"
          >
            Exit focus
          </button>
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
