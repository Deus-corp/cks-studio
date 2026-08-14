// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from '../settingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSettingsStore.getState().resetAllSettings()
  })

  it('starts with the documented defaults', () => {
    const state = useSettingsStore.getState()
    expect(state.defaultViewMode).toBe('2d')
    expect(state.defaultLayoutDirection).toBe('TB')
    expect(state.showMiniMap).toBe(true)
    expect(state.showTypeLegend).toBe(true)
    expect(state.showEdgeLabels).toBe(true)
    expect(state.mcpServerUrl).toBe('http://127.0.0.1:8765')
    expect(state.recentSessionIds).toEqual([])
    expect(state.autoReconnectSse).toBe(true)
    expect(state.selectedModel).toBeNull()
    expect(state.provider).toBeNull()
    expect(state.quickAiPanelDefaultOpen).toBe(false)
    expect(state.focusModeEnabledByDefault2D).toBe(false)
    expect(state.focusModeEnabledByDefault3D).toBe(false)
    expect(state.degreeBasedSizingEnabled).toBe(true)
    expect(state.sseRefreshDebounceMs).toBe(400)
    expect(state.pollingIntervalMs).toBe(10000)
  })

  it('persists a changed setting to localStorage', () => {
    useSettingsStore.getState().setDefaultViewMode('3d')
    useSettingsStore.getState().setShowMiniMap(false)
    useSettingsStore.getState().setPollingIntervalMs(5000)

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw as string)
    expect(persisted.state.defaultViewMode).toBe('3d')
    expect(persisted.state.showMiniMap).toBe(false)
    expect(persisted.state.pollingIntervalMs).toBe(5000)
  })

  it('survives a simulated reload (store re-hydrated from localStorage)', () => {
    useSettingsStore.getState().setMcpServerUrl('http://example.com:9999')
    useSettingsStore.getState().setSelectedModel('llama3.2')

    // Simulate "reload" by re-reading persisted JSON, the way zustand's
    // persist middleware would on next module init.
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    const persisted = JSON.parse(raw as string)
    expect(persisted.state.mcpServerUrl).toBe('http://example.com:9999')
    expect(persisted.state.selectedModel).toBe('llama3.2')
  })

  it('addRecentSessionId dedupes and caps at 5, most recent first', () => {
    const { addRecentSessionId } = useSettingsStore.getState()
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      addRecentSessionId(id)
    }
    // Re-adding an existing id moves it to the front instead of
    // duplicating it.
    addRecentSessionId('c')

    const { recentSessionIds } = useSettingsStore.getState()
    expect(recentSessionIds).toHaveLength(5)
    expect(recentSessionIds[0]).toBe('c')
    expect(new Set(recentSessionIds).size).toBe(recentSessionIds.length)
  })

  it('clearRecentSessionIds empties the list', () => {
    useSettingsStore.getState().addRecentSessionId('session-1')
    useSettingsStore.getState().clearRecentSessionIds()
    expect(useSettingsStore.getState().recentSessionIds).toEqual([])
  })

  it('resetAllSettings restores every field to its default', () => {
    const store = useSettingsStore.getState()
    store.setDefaultViewMode('3d')
    store.setShowMiniMap(false)
    store.setMcpServerUrl('http://changed:1234')
    store.addRecentSessionId('some-session')
    store.setSelectedModel('llama3.2')
    store.setProvider('ollama')
    store.setPollingIntervalMs(1234)

    store.resetAllSettings()

    const state = useSettingsStore.getState()
    expect(state.defaultViewMode).toBe(DEFAULT_SETTINGS.defaultViewMode)
    expect(state.showMiniMap).toBe(DEFAULT_SETTINGS.showMiniMap)
    expect(state.mcpServerUrl).toBe(DEFAULT_SETTINGS.mcpServerUrl)
    expect(state.recentSessionIds).toEqual(DEFAULT_SETTINGS.recentSessionIds)
    expect(state.selectedModel).toBe(DEFAULT_SETTINGS.selectedModel)
    expect(state.provider).toBe(DEFAULT_SETTINGS.provider)
    expect(state.pollingIntervalMs).toBe(DEFAULT_SETTINGS.pollingIntervalMs)
  })
})
