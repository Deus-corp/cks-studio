import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

interface GraphState {
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
      return { nodes: [...state.nodes, ...newNodes.filter((n) => !existing.has(n.id))] }
    }),
  addEdges: (newEdges) =>
    set((state) => {
      const existing = new Set(state.edges.map((e) => `${e.source}->${e.target}:${e.label}`))
      const filtered = newEdges.filter(
        (e) => !existing.has(`${e.source}->${e.target}:${e.label}`)
      )
      return { edges: [...state.edges, ...filtered] }
    }),
  selectNode: (id) => set({ selectedNodeId: id }),
  setHighlightedEdges: (edgeIds) => set({ highlightedEdgeIds: edgeIds }),
  clearHighlight: () => set({ highlightedEdgeIds: new Set() }),
}))