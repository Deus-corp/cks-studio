// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LLMStatus } from '@/services/mcpTools'
import { ChatPanel } from '../features/ai-chat/ChatPanel'
import type { ChatError } from '../features/ai-chat/useAiChat'

const { useAiChatMock, useLLMStatusMock } = vi.hoisted(() => ({
  useAiChatMock: vi.fn(),
  useLLMStatusMock: vi.fn(),
}))

vi.mock('../features/ai-chat/useAiChat', () => ({
  useAiChat: useAiChatMock,
}))
vi.mock('@/features/llm-status/useLLMStatus', () => ({
  useLLMStatus: useLLMStatusMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function chatState(
  overrides: Partial<ReturnType<typeof defaultChatState>> = {},
) {
  return { ...defaultChatState(), ...overrides }
}
function defaultChatState() {
  return {
    turns: [] as { role: 'user' | 'assistant'; text: string }[],
    isSending: false,
    error: null as ChatError | null,
    send: vi.fn(),
  }
}

function llmStatusState(
  overrides: Partial<ReturnType<typeof defaultLLMStatusState>> = {},
) {
  return { ...defaultLLMStatusState(), ...overrides }
}
function defaultLLMStatusState() {
  return {
    status: null as LLMStatus | null,
    isLoading: false,
    error: null as string | null,
    refresh: vi.fn(),
  }
}

function renderChatPanel() {
  return render(
    <MemoryRouter>
      <ChatPanel />
    </MemoryRouter>,
  )
}

describe('ChatPanel — error banners', () => {
  it('shows "No active session" with a link to the Graph tab for a no_session error', () => {
    useAiChatMock.mockReturnValue(
      chatState({
        error: {
          kind: 'no_session',
          message: 'Connect to a session on the Graph page first.',
        },
      }),
    )
    useLLMStatusMock.mockReturnValue(llmStatusState())

    renderChatPanel()

    expect(screen.getByText(/No active session/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Graph tab/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('shows setup instructions for llm_provider_unavailable', () => {
    useAiChatMock.mockReturnValue(
      chatState({
        error: {
          kind: 'llm_provider_unavailable',
          message: 'No LLM provider available for ai_chat.',
        },
      }),
    )
    // Top LLMStatusBanner not shown (status still 'ollama', say a race
    // where it flipped) — so the under-form instructions must appear.
    useLLMStatusMock.mockReturnValue(
      llmStatusState({
        status: {
          provider: 'ollama',
          ollama_available: false,
          anthropic_configured: false,
          model: 'llama3.2',
        },
      }),
    )

    renderChatPanel()

    expect(screen.getByText(/ollama run llama3.2/)).toBeInTheDocument()
    expect(screen.getByText('ANTHROPIC_API_KEY')).toBeInTheDocument()
    expect(screen.getByText(/~\/\.cks-mcp\/\.env/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Open Settings/i }),
    ).toHaveAttribute('href', '/settings')
  })

  it('does not duplicate the llm_provider_unavailable banner when the top banner already shows it', () => {
    useAiChatMock.mockReturnValue(
      chatState({
        error: {
          kind: 'llm_provider_unavailable',
          message: 'No LLM provider available for ai_chat.',
        },
      }),
    )
    useLLMStatusMock.mockReturnValue(
      llmStatusState({
        status: {
          provider: 'none',
          ollama_available: false,
          anthropic_configured: false,
          model: null,
        },
      }),
    )

    renderChatPanel()

    // Top LLMStatusBanner renders "Start Ollama (ollama run llama3.2)";
    // the under-form ChatErrorBanner would additionally render "Run
    // ollama run llama3.2" as a numbered step -- there should be exactly
    // one "ollama run llama3.2" on screen, not two.
    expect(screen.getAllByText(/ollama run llama3\.2/)).toHaveLength(1)
  })

  it('shows "Could not reach cks-mcp" for a network error', () => {
    useAiChatMock.mockReturnValue(
      chatState({
        error: {
          kind: 'network',
          message: 'Could not reach cks-mcp. Is the server running?',
        },
      }),
    )
    useLLMStatusMock.mockReturnValue(llmStatusState())

    renderChatPanel()

    expect(
      screen.getByText('Could not reach cks-mcp. Is the server running?'),
    ).toBeInTheDocument()
  })

  it('shows the llm_call_failed message as-is, in a non-yellow banner', () => {
    useAiChatMock.mockReturnValue(
      chatState({
        error: {
          kind: 'llm_call_failed',
          message:
            'LLM call failed: Anthropic API returned HTTP 529: overloaded. Try again or check Settings.',
        },
      }),
    )
    useLLMStatusMock.mockReturnValue(llmStatusState())

    renderChatPanel()

    expect(screen.getByText(/LLM call failed:/)).toBeInTheDocument()
    expect(
      screen.getByText(/Try again or check Settings\./),
    ).toBeInTheDocument()
  })

  it('renders no error banner when there is no error', () => {
    useAiChatMock.mockReturnValue(chatState())
    useLLMStatusMock.mockReturnValue(llmStatusState())

    renderChatPanel()

    expect(screen.queryByText(/No active session/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Could not reach cks-mcp/),
    ).not.toBeInTheDocument()
  })
})
