import type { Edge, Node } from '@xyflow/react'
import { create } from 'zustand'

export interface RelationDraftState {
  active: boolean
  participantIds: string[]
}

export interface GraphState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  highlightedEdgeIds: Set<string>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  addNodes: (newNodes: Node[]) => void
  addEdges: (newEdges: Edge[]) => void
  selectNode: (id: string | null) => void
  setHighlightedEdges: (edgeIds: Set<string>) => void
  clearHighlight: () => void
  addPendingNode: (node: Node) => void
  commitPendingNode: (id: string) => void
  rollbackPendingNode: (id: string) => void
  addPendingEdge: (edge: Edge) => void
  commitPendingEdge: (id: string) => void
  rollbackPendingEdge: (id: string) => void
  relationDraft: RelationDraftState
  startRelationDraft: () => void
  cancelRelationDraft: () => void
  toggleRelationParticipant: (id: string) => void
  /** CKS types currently hidden from the canvas (legend checkboxes). */
  hiddenTypes: Set<string>
  toggleTypeVisibility: (type: string) => void
  showAllTypes: () => void
  /** '2d' (default, dagre + xyflow) or '3d' (force-directed sphere,
   *  see GraphCanvas3D) — dense graphs with many same-rank nodes
   *  (e.g. many Tools implementing one ADR) stretch very wide in 2D
   *  since dagre lays same-rank nodes out in a single row; 3D spreads
   *  them over a volume instead. */
  viewMode: '2d' | '3d'
  setViewMode: (mode: '2d' | '3d') => void
  /** dagre rankdir for the 2D layout. 'TB' (default) puts same-rank
   *  siblings in one wide horizontal row -- graphs with many nodes
   *  sharing a rank (e.g. many Tools implementing one ADR) stretch very
   *  wide. 'LR' rotates the same layout 90°, trading width for height,
   *  which reads better on an ultrawide monitor or when the graph is
   *  bushier than it is deep. */
  layoutDirection: 'TB' | 'LR'
  setLayoutDirection: (dir: 'TB' | 'LR') => void
  /** Multi-node selection (2D: Ctrl/Cmd+click toggles, plain click
   *  replaces with just that node; 3D: same via GraphCanvas3D's
   *  onNodeClick). Separate from `selectedNodeId` -- that one drives the
   *  single-node SidePanel and is left alone by multi-select toggling so
   *  the detail panel doesn't flicker between nodes as you Ctrl-click
   *  around. Used to gather object_ids for the "Start Pipeline" action. */
  multiSelectedIds: Set<string>
  toggleMultiSelect: (id: string) => void
  setMultiSelect: (ids: string[] | Set<string>) => void
  clearMultiSelect: () => void
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  highlightedEdgeIds: new Set(),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNodes: (newNodes) =>
    set((state) => {
      const existing = new Set(state.nodes.map((n) => n.id))
      return {
        nodes: [...state.nodes, ...newNodes.filter((n) => !existing.has(n.id))],
      }
    }),
  addEdges: (newEdges) =>
    set((state) => {
      const existing = new Set(
        state.edges.map((e) => `${e.source}->${e.target}:${e.label}`),
      )
      const filtered = newEdges.filter(
        (e) => !existing.has(`${e.source}->${e.target}:${e.label}`),
      )
      return { edges: [...state.edges, ...filtered] }
    }),
  selectNode: (id) => set({ selectedNodeId: id }),
  setHighlightedEdges: (edgeIds) => set({ highlightedEdgeIds: edgeIds }),
  clearHighlight: () => set({ highlightedEdgeIds: new Set() }),

  addPendingNode: (node) =>
    set((state) => {
      if (state.nodes.some((n) => n.id === node.id)) return state
      return {
        nodes: [
          ...state.nodes,
          { ...node, data: { ...node.data, _pending: true } },
        ],
      }
    }),
  commitPendingNode: (id) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, _pending: false } } : n,
      ),
    })),
  rollbackPendingNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => !(n.id === id && n.data._pending)),
    })),

  addPendingEdge: (edge) =>
    set((state) => {
      if (state.edges.some((e) => e.id === edge.id)) return state
      return {
        edges: [
          ...state.edges,
          {
            ...edge,
            style: { ...edge.style, strokeDasharray: '4 4' },
            data: { ...edge.data, _pending: true },
          },
        ],
      }
    }),
  commitPendingEdge: (id) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id
          ? {
              ...e,
              style: { ...e.style, strokeDasharray: undefined },
              data: { ...e.data, _pending: false },
            }
          : e,
      ),
    })),
  rollbackPendingEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => !(e.id === id && e.data?._pending)),
    })),

  relationDraft: { active: false, participantIds: [] },
  startRelationDraft: () =>
    set({ relationDraft: { active: true, participantIds: [] } }),
  cancelRelationDraft: () =>
    set({ relationDraft: { active: false, participantIds: [] } }),
  toggleRelationParticipant: (id) =>
    set((state) => {
      const { participantIds } = state.relationDraft
      const alreadySelected = participantIds.includes(id)
      const next = alreadySelected
        ? participantIds.filter((p) => p !== id)
        : participantIds.length < 2
          ? [...participantIds, id]
          : participantIds
      return { relationDraft: { active: true, participantIds: next } }
    }),

  hiddenTypes: new Set(),
  toggleTypeVisibility: (type) =>
    set((state) => {
      const next = new Set(state.hiddenTypes)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return { hiddenTypes: next }
    }),
  showAllTypes: () => set({ hiddenTypes: new Set() }),

  viewMode: '2d',
  setViewMode: (mode) => set({ viewMode: mode }),

  layoutDirection: 'TB',
  setLayoutDirection: (dir) => set({ layoutDirection: dir }),

  multiSelectedIds: new Set(),
  toggleMultiSelect: (id) =>
    set((state) => {
      const next = new Set(state.multiSelectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { multiSelectedIds: next }
    }),
  setMultiSelect: (ids) => set({ multiSelectedIds: new Set(ids) }),
  clearMultiSelect: () => set({ multiSelectedIds: new Set() }),
}))
