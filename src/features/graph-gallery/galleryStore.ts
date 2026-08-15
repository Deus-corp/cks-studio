// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { create } from 'zustand'
import { checkGraphHealth, listGraphs, searchGraphs } from '@/services/mcpTools'
import type {
  GraphHealthResult,
  GraphHealthUnavailable,
  GraphRegistryEntry,
} from '@/shared/types/graph'
import type { GallerySortOrder } from './galleryUtils'

export interface GalleryState {
  graphs: GraphRegistryEntry[]
  query: string
  tag: string
  publicOnly: boolean
  sortBy: GallerySortOrder
  isLoading: boolean
  error: string | null
  /** health_score/детали по имени графа — считается лениво, по клику, не на весь список сразу. */
  health: Record<string, GraphHealthResult | GraphHealthUnavailable>
  healthLoading: Record<string, boolean>
  setQuery: (query: string) => void
  setTag: (tag: string) => void
  setPublicOnly: (publicOnly: boolean) => void
  setSortBy: (sortBy: GallerySortOrder) => void
  load: () => Promise<void>
  loadHealth: (name: string) => Promise<void>
}

export const useGalleryStore = create<GalleryState>((set, get) => ({
  graphs: [],
  query: '',
  tag: '',
  publicOnly: true,
  sortBy: 'updated_desc',
  isLoading: false,
  error: null,
  health: {},
  healthLoading: {},

  setQuery: (query) => set({ query }),
  setTag: (tag) => set({ tag }),
  setPublicOnly: (publicOnly) => set({ publicOnly }),
  setSortBy: (sortBy) => set({ sortBy }),

  load: async () => {
    const { query, tag, publicOnly } = get()
    set({ isLoading: true, error: null })
    try {
      const options = { tag: tag || undefined, publicOnly }
      const graphs = query.trim()
        ? await searchGraphs(query.trim(), options)
        : await listGraphs(options)
      set({ graphs })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      set({ isLoading: false })
    }
  },

  loadHealth: async (name) => {
    set((state) => ({
      healthLoading: { ...state.healthLoading, [name]: true },
    }))
    try {
      const result = await checkGraphHealth(name)
      set((state) => ({
        health: { ...state.health, [name]: result },
      }))
    } catch (e) {
      set((state) => ({
        error: e instanceof Error ? e.message : 'Unknown error',
        healthLoading: { ...state.healthLoading, [name]: false },
      }))
      return
    }
    set((state) => ({
      healthLoading: { ...state.healthLoading, [name]: false },
    }))
  },
}))
