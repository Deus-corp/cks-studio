// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Settings 2.0 — единый локальный стор пользовательских предпочтений
 * cks-studio. Studio — чистый frontend, поэтому всё здесь живёт только в
 * localStorage и применяется к UI; сервер (cks-mcp) ничего об этих
 * настройках не знает и не может быть переконфигурирован отсюда.
 *
 * Разграничение с существующими стораами:
 *  - themeStore остаётся source of truth для `data-theme` атрибута и
 *    собственного ключа `cks-studio:theme` (не трогаем его persist-логику,
 *    чтобы не сломать текущих пользователей). `theme` здесь — зеркало,
 *    обновляемое через syncThemeFromStore()/setTheme(), чтобы Settings 2.0
 *    мог быть единой точкой чтения на будущее.
 *  - sessionStore остаётся source of truth для активного `serverUrl` /
 *    `sessionId` (там же живёт логика reconnect). `mcpServerUrl` здесь —
 *    отдельное поле "default/last used" для Connection-секции; страницы,
 *    которым нужен именно активный URL, продолжают читать sessionStore.
 *  - graphExplorerStore остаётся source of truth для *текущего* viewMode /
 *    layoutDirection в рамках открытого графа. `defaultViewMode` /
 *    `defaultLayoutDirection` здесь — это то, что подставляется при первом
 *    открытии GraphPage, до того как пользователь явно переключил вид.
 */

export type ViewMode = '2d' | '3d'
export type LayoutDirection = 'TB' | 'LR'
export type LLMProviderPreference =
  | 'ollama'
  | 'anthropic'
  | 'openai_compatible'
  | null

export interface SettingsState {
  // Appearance
  theme: 'light' | 'dark' | 'auto'
  defaultViewMode: ViewMode
  defaultLayoutDirection: LayoutDirection
  showMiniMap: boolean
  showTypeLegend: boolean
  showEdgeLabels: boolean

  // Connection
  mcpServerUrl: string
  recentSessionIds: string[]
  autoReconnectSse: boolean

  // AI / LLM
  selectedModel: string | null
  provider: LLMProviderPreference
  quickAiPanelDefaultOpen: boolean

  // Graph behavior
  focusModeEnabledByDefault2D: boolean
  focusModeEnabledByDefault3D: boolean
  degreeBasedSizingEnabled: boolean
  sseRefreshDebounceMs: number
  pollingIntervalMs: number

  // Actions
  setTheme: (theme: SettingsState['theme']) => void
  setDefaultViewMode: (mode: ViewMode) => void
  setDefaultLayoutDirection: (dir: LayoutDirection) => void
  setShowMiniMap: (value: boolean) => void
  setShowTypeLegend: (value: boolean) => void
  setShowEdgeLabels: (value: boolean) => void
  setMcpServerUrl: (url: string) => void
  addRecentSessionId: (sessionId: string) => void
  clearRecentSessionIds: () => void
  setAutoReconnectSse: (value: boolean) => void
  setSelectedModel: (model: string | null) => void
  setProvider: (provider: LLMProviderPreference) => void
  setQuickAiPanelDefaultOpen: (value: boolean) => void
  setFocusModeEnabledByDefault2D: (value: boolean) => void
  setFocusModeEnabledByDefault3D: (value: boolean) => void
  setDegreeBasedSizingEnabled: (value: boolean) => void
  setSseRefreshDebounceMs: (ms: number) => void
  setPollingIntervalMs: (ms: number) => void
  resetAllSettings: () => void
}

const MAX_RECENT_SESSION_IDS = 5

export const DEFAULT_SETTINGS: Omit<SettingsState, keyof SettingsActions> = {
  theme: 'dark',
  defaultViewMode: '2d',
  defaultLayoutDirection: 'TB',
  showMiniMap: true,
  showTypeLegend: true,
  showEdgeLabels: true,

  mcpServerUrl: 'http://127.0.0.1:8765',
  recentSessionIds: [],
  autoReconnectSse: true,

  selectedModel: null,
  provider: null,
  quickAiPanelDefaultOpen: false,

  focusModeEnabledByDefault2D: false,
  focusModeEnabledByDefault3D: false,
  degreeBasedSizingEnabled: true,
  sseRefreshDebounceMs: 400,
  pollingIntervalMs: 10000,
}

// Helper type used only to compute DEFAULT_SETTINGS' shape above.
type SettingsActions = {
  setTheme: unknown
  setDefaultViewMode: unknown
  setDefaultLayoutDirection: unknown
  setShowMiniMap: unknown
  setShowTypeLegend: unknown
  setShowEdgeLabels: unknown
  setMcpServerUrl: unknown
  addRecentSessionId: unknown
  clearRecentSessionIds: unknown
  setAutoReconnectSse: unknown
  setSelectedModel: unknown
  setProvider: unknown
  setQuickAiPanelDefaultOpen: unknown
  setFocusModeEnabledByDefault2D: unknown
  setFocusModeEnabledByDefault3D: unknown
  setDegreeBasedSizingEnabled: unknown
  setSseRefreshDebounceMs: unknown
  setPollingIntervalMs: unknown
  resetAllSettings: unknown
}

export const SETTINGS_STORAGE_KEY = 'cks-studio:settings'

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setTheme: (theme) => set({ theme }),
      setDefaultViewMode: (defaultViewMode) => set({ defaultViewMode }),
      setDefaultLayoutDirection: (defaultLayoutDirection) =>
        set({ defaultLayoutDirection }),
      setShowMiniMap: (showMiniMap) => set({ showMiniMap }),
      setShowTypeLegend: (showTypeLegend) => set({ showTypeLegend }),
      setShowEdgeLabels: (showEdgeLabels) => set({ showEdgeLabels }),

      setMcpServerUrl: (mcpServerUrl) => set({ mcpServerUrl }),
      addRecentSessionId: (sessionId) =>
        set((state) => {
          const trimmed = sessionId.trim()
          if (!trimmed) return state
          const withoutDup = state.recentSessionIds.filter(
            (id) => id !== trimmed,
          )
          return {
            recentSessionIds: [trimmed, ...withoutDup].slice(
              0,
              MAX_RECENT_SESSION_IDS,
            ),
          }
        }),
      clearRecentSessionIds: () => set({ recentSessionIds: [] }),
      setAutoReconnectSse: (autoReconnectSse) => set({ autoReconnectSse }),

      setSelectedModel: (selectedModel) => set({ selectedModel }),
      setProvider: (provider) => set({ provider }),
      setQuickAiPanelDefaultOpen: (quickAiPanelDefaultOpen) =>
        set({ quickAiPanelDefaultOpen }),

      setFocusModeEnabledByDefault2D: (focusModeEnabledByDefault2D) =>
        set({ focusModeEnabledByDefault2D }),
      setFocusModeEnabledByDefault3D: (focusModeEnabledByDefault3D) =>
        set({ focusModeEnabledByDefault3D }),
      setDegreeBasedSizingEnabled: (degreeBasedSizingEnabled) =>
        set({ degreeBasedSizingEnabled }),
      setSseRefreshDebounceMs: (sseRefreshDebounceMs) =>
        set({ sseRefreshDebounceMs }),
      setPollingIntervalMs: (pollingIntervalMs) => set({ pollingIntervalMs }),

      resetAllSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      // Only persist data fields, not actions (avoids bloating localStorage
      // and keeps the persisted shape stable if actions are refactored).
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([, value]) => typeof value !== 'function',
          ),
        ) as Partial<SettingsState>,
    },
  ),
)
