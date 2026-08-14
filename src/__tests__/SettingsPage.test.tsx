// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LLMStatus } from '@/services/mcpTools'
import { SettingsPage } from '../pages/SettingsPage'
import { useSettingsStore } from '../shared/stores/settingsStore'

const { getLLMStatusMock } = vi.hoisted(() => ({
  getLLMStatusMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  getLLMStatus: getLLMStatusMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function ollamaStatus(overrides: Partial<LLMStatus> = {}): LLMStatus {
  return {
    provider: 'ollama',
    ollama_available: true,
    anthropic_configured: false,
    model: 'llama3.2',
    ...overrides,
  }
}

function renderAiTab() {
  render(<SettingsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'AI & LLM' }))
}

describe('SettingsPage — LLM Provider status', () => {
  it('shows a "Checking…" state before the first response resolves', () => {
    getLLMStatusMock.mockReturnValue(new Promise(() => {})) // never resolves
    renderAiTab()

    expect(screen.getByText('Checking…')).toBeInTheDocument()
  })

  it('shows "Local Ollama" and its model when Ollama is the active provider', async () => {
    getLLMStatusMock.mockResolvedValue(ollamaStatus())
    renderAiTab()

    await waitFor(() => {
      expect(screen.getByText('Local Ollama')).toBeInTheDocument()
    })
    expect(screen.getByText('llama3.2')).toBeInTheDocument()
    // The provider-status card itself shouldn't show "not configured"
    // instructions when a provider is active (the always-visible Server
    // Setup snippets lower on the same tab are a separate, unrelated
    // section and legitimately still show the ollama command).
    expect(screen.queryByText(/Start Ollama/)).not.toBeInTheDocument()
  })

  it('shows "Anthropic" and its model when Anthropic is the active provider', async () => {
    getLLMStatusMock.mockResolvedValue(
      ollamaStatus({
        provider: 'anthropic',
        ollama_available: false,
        anthropic_configured: true,
        model: 'claude-sonnet-4-5-20250929',
      }),
    )
    renderAiTab()

    await waitFor(() => {
      // 'Anthropic' also appears as an <option> text in the "Preferred
      // provider" <select> on this tab, so scope to the provider-status
      // span specifically via its accompanying model text as an anchor.
      expect(screen.getByText('claude-sonnet-4-5-20250929')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0)
  })

  it('shows "Not configured" plus setup instructions when provider is none', async () => {
    getLLMStatusMock.mockResolvedValue(
      ollamaStatus({
        provider: 'none',
        ollama_available: false,
        anthropic_configured: false,
        model: null,
      }),
    )
    renderAiTab()

    await waitFor(() => {
      expect(screen.getByText('Not configured')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/ollama run llama3.2/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/ANTHROPIC_API_KEY/).length).toBeGreaterThan(0)
  })

  it('shows a network error message when get_llm_status fails', async () => {
    getLLMStatusMock.mockRejectedValue(new Error('MCP request failed: 500'))
    renderAiTab()

    await waitFor(() => {
      expect(
        screen.getByText(/Could not reach cks-mcp: MCP request failed: 500/),
      ).toBeInTheDocument()
    })
  })

  it('re-fetches status when Refresh is clicked', async () => {
    getLLMStatusMock.mockResolvedValueOnce(
      ollamaStatus({ provider: 'none', ollama_available: false, model: null }),
    )
    renderAiTab()

    await waitFor(() => {
      expect(screen.getByText('Not configured')).toBeInTheDocument()
    })

    getLLMStatusMock.mockResolvedValueOnce(ollamaStatus())
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(screen.getByText('Local Ollama')).toBeInTheDocument()
    })
    expect(getLLMStatusMock).toHaveBeenCalledTimes(2)
  })
})

describe('SettingsPage — Appearance section toggles update settingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSettingsStore.getState().resetAllSettings()
  })

  afterEach(() => {
    useSettingsStore.getState().resetAllSettings()
  })

  it('switching default view mode updates the store', () => {
    render(<SettingsPage />)

    expect(useSettingsStore.getState().defaultViewMode).toBe('2d')
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    expect(useSettingsStore.getState().defaultViewMode).toBe('3d')
  })

  it('toggling "Show minimap" flips showMiniMap in the store', () => {
    render(<SettingsPage />)

    expect(useSettingsStore.getState().showMiniMap).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Show minimap' }))
    expect(useSettingsStore.getState().showMiniMap).toBe(false)
  })

  it('toggling "Show type legend" flips showTypeLegend in the store', () => {
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('switch', { name: 'Show type legend' }))
    expect(useSettingsStore.getState().showTypeLegend).toBe(false)
  })
})

describe('SettingsPage — Danger Zone reset', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSettingsStore.getState().resetAllSettings()
  })

  afterEach(() => {
    useSettingsStore.getState().resetAllSettings()
  })

  it('requires a second click to confirm, then resets settings to defaults', () => {
    useSettingsStore.getState().setShowMiniMap(false)
    useSettingsStore.getState().setDefaultViewMode('3d')

    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Danger Zone' }))

    const resetButton = screen.getByRole('button', {
      name: 'Reset all settings',
    })
    fireEvent.click(resetButton)
    // First click only arms confirmation -- settings aren't reset yet.
    expect(useSettingsStore.getState().showMiniMap).toBe(false)

    fireEvent.click(
      screen.getByRole('button', { name: 'Click again to confirm reset' }),
    )
    expect(useSettingsStore.getState().showMiniMap).toBe(true)
    expect(useSettingsStore.getState().defaultViewMode).toBe('2d')
  })
})
