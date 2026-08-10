// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LLMStatus } from '@/services/mcpTools'
import { SettingsPage } from '../pages/SettingsPage'

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

describe('SettingsPage — LLM Provider status', () => {
  it('shows a "Checking…" state before the first response resolves', () => {
    getLLMStatusMock.mockReturnValue(new Promise(() => {})) // never resolves
    render(<SettingsPage />)

    expect(screen.getByText('Checking…')).toBeInTheDocument()
  })

  it('shows "Local Ollama" and its model when Ollama is the active provider', async () => {
    getLLMStatusMock.mockResolvedValue(ollamaStatus())
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Local Ollama')).toBeInTheDocument()
    })
    expect(screen.getByText('llama3.2')).toBeInTheDocument()
    // No "not configured" instructions when a provider is active.
    expect(screen.queryByText(/ollama run llama3.2/)).not.toBeInTheDocument()
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
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Anthropic')).toBeInTheDocument()
    })
    expect(screen.getByText('claude-sonnet-4-5-20250929')).toBeInTheDocument()
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
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Not configured')).toBeInTheDocument()
    })
    expect(screen.getByText(/ollama run llama3.2/)).toBeInTheDocument()
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument()
  })

  it('shows a network error message when get_llm_status fails', async () => {
    getLLMStatusMock.mockRejectedValue(new Error('MCP request failed: 500'))
    render(<SettingsPage />)

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
    render(<SettingsPage />)

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
