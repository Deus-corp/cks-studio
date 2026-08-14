// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('graphExplorerStore — seeded from settingsStore defaults', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('uses defaultViewMode / defaultLayoutDirection from settingsStore at module init', async () => {
    const { useSettingsStore } = await import(
      '../../../shared/stores/settingsStore'
    )
    useSettingsStore.getState().setDefaultViewMode('3d')
    useSettingsStore.getState().setDefaultLayoutDirection('LR')

    // Import graphExplorerStore *after* settingsStore has the desired
    // localStorage-backed state -- mirrors real module init order,
    // where settingsStore.getState() is read once at the top of
    // graphExplorerStore.ts.
    const { useGraphStore } = await import('../graphExplorerStore')

    expect(useGraphStore.getState().viewMode).toBe('3d')
    expect(useGraphStore.getState().layoutDirection).toBe('LR')
  })

  it('falls back to 2d/TB when settingsStore has no overrides', async () => {
    const { useGraphStore } = await import('../graphExplorerStore')

    expect(useGraphStore.getState().viewMode).toBe('2d')
    expect(useGraphStore.getState().layoutDirection).toBe('TB')
  })
})
