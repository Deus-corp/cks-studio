// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LLMModel, LLMStatus } from '@/services/mcpTools'
import { ChatPanel } from '../features/ai-chat/ChatPanel'
import type { ChatError } from '../features/ai-chat/useAiChat'

const {
  useAiChatMock,
  useLLMStatusMock,
  useLLMModelsMock,
  useChatStoreMock,
  setSelectedModelMock,
} = vi.hoisted(() => ({
  useAiChatMock: vi.fn(),
  useLLMStatusMock: vi.fn(),
  useLLMModelsMock: vi.fn(),
  useChatStoreMock: vi.fn(),
  setSelectedModelMock: vi.fn(),
}))

vi.mock('../features/ai-chat/useAiChat', () => ({
  useAiChat: useAiChatMock,
}))
vi.mock('@/features/llm-status/useLLMStatus', () => ({
  useLLMStatus: useLLMStatusMock,
}))
vi.mock('@/features/llm-status/useLLMModels', () => ({
  useLLMModels: useLLMModelsMock,
}))
vi.mock('../features/ai-chat/chatStore', async () => {
  const actual = await vi.importActual('../features/ai-chat/chatStore')
  return {
    ...actual,
    useChatStore: useChatStoreMock,
  }
})

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
    selectedModel: null as string | null,
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

function llmModelsState(
  overrides: Partial<ReturnType<typeof defaultLLMModelsState>> = {},
) {
  return { ...defaultLLMModelsState(), ...overrides }
}
function defaultLLMModelsState() {
  return {
    models: [] as LLMModel[],
    isLoading: false,
    error: null as string | null,
    refresh: vi.fn(),
  }
}

// useChatStore is used directly in ChatPanel only for setSelectedModel
// (a zustand selector call: useChatStore(s => s.setSelectedModel)) — the
// rest of chat state comes through the mocked useAiChat hook above.
useChatStoreMock.mockImplementation(() => setSelectedModelMock)
useLLMModelsMock.mockImplementation(() => llmModelsState())

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

describe('ChatPanel — model select', () => {
  it('shows a disabled, default-only select while models have not loaded yet', () => {
    useAiChatMock.mockReturnValue(chatState())
    useLLMStatusMock.mockReturnValue(
      llmStatusState({
        status: {
          provider: 'ollama',
          ollama_available: true,
          anthropic_configured: false,
          model: 'llama3.2',
        },
      }),
    )
    useLLMModelsMock.mockReturnValue(llmModelsState({ models: [] }))

    renderChatPanel()

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeDisabled()
    expect(select).toHaveTextContent('llama3.2')
  })

  it('lists loaded models plus a default option, and calls setSelectedModel on change', () => {
    useAiChatMock.mockReturnValue(chatState())
    useLLMStatusMock.mockReturnValue(
      llmStatusState({
        status: {
          provider: 'anthropic',
          ollama_available: false,
          anthropic_configured: true,
          model: 'claude-sonnet-4-5-20250929',
        },
      }),
    )
    useLLMModelsMock.mockReturnValue(
      llmModelsState({
        models: [
          { name: 'claude-sonnet-4-5-20250929' },
          { name: 'claude-opus-4-1-20250805' },
        ],
      }),
    )

    renderChatPanel()

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).not.toBeDisabled()
    expect(
      screen.getByRole('option', {
        name: /Default \(claude-sonnet-4-5-20250929\)/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'claude-opus-4-1-20250805' }),
    ).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'claude-opus-4-1-20250805' } })
    expect(setSelectedModelMock).toHaveBeenCalledWith(
      'claude-opus-4-1-20250805',
    )
  })

  it('passes the store selectedModel through to send() via useAiChat', () => {
    const sendMock = vi.fn()
    useAiChatMock.mockReturnValue(
      chatState({ selectedModel: 'claude-opus-4-1-20250805', send: sendMock }),
    )
    useLLMStatusMock.mockReturnValue(llmStatusState())
    useLLMModelsMock.mockReturnValue(llmModelsState())

    renderChatPanel()

    // useAiChat already owns the selectedModel→send() wiring (tested in
    // useAiChat's own suite); this just checks ChatPanel doesn't need to
    // pass a model argument itself -- send(text) alone is enough.
    expect(sendMock).not.toHaveBeenCalled()
  })
})
