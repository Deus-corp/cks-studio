// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuickAiPanel } from '../features/ai-chat/QuickAiPanel'
import type { ChatError } from '../features/ai-chat/useAiChat'
import { useSessionStore } from '../services/sessionStore'

const { useAiChatMock, navigateMock } = vi.hoisted(() => ({
  useAiChatMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../features/ai-chat/useAiChat', () => ({
  useAiChat: useAiChatMock,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function aiChatState(overrides: Partial<ReturnType<typeof defaultState>> = {}) {
  return { ...defaultState(), ...overrides }
}
function defaultState() {
  return {
    turns: [] as { role: 'user' | 'assistant'; text: string }[],
    isSending: false,
    error: null as ChatError | null,
    selectedModel: null as string | null,
    send: vi.fn(),
    retry: vi.fn(),
  }
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <QuickAiPanel />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useSessionStore.getState().setSessionId('')
})

describe('QuickAiPanel', () => {
  it('renders collapsed by default as a slim button', () => {
    useAiChatMock.mockReturnValue(aiChatState())
    renderPanel()

    expect(
      screen.getByRole('button', { name: /quick ai/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(/ask anything/i),
    ).not.toBeInTheDocument()
  })

  it('shows a "connect a session" message when there is no session', () => {
    useAiChatMock.mockReturnValue(aiChatState())
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))

    expect(
      screen.getByText(/connect to a session on this page first/i),
    ).toBeInTheDocument()
  })

  it('sends a message via the send button and calls useAiChat().send', () => {
    useSessionStore.getState().setSessionId('sess-1')
    const send = vi.fn()
    useAiChatMock.mockReturnValue(aiChatState({ send }))
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    fireEvent.change(screen.getByPlaceholderText(/ask anything/i), {
      target: { value: 'What connects these two nodes?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    expect(send).toHaveBeenCalledWith('What connects these two nodes?')
  })

  it('sends on Enter and inserts a newline on Shift+Enter', () => {
    useSessionStore.getState().setSessionId('sess-1')
    const send = vi.fn()
    useAiChatMock.mockReturnValue(aiChatState({ send }))
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    const textarea = screen.getByPlaceholderText(/ask anything/i)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(send).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(send).toHaveBeenCalledWith('hello')
  })

  it('renders turns and a loading indicator while sending', () => {
    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(
      aiChatState({
        turns: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello there' },
        ],
        isSending: true,
      }),
    )
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))

    expect(screen.getByText('Hi')).toBeInTheDocument()
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText(/thinking…/i)).toBeInTheDocument()
  })

  it('shows an inline error message', () => {
    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(
      aiChatState({
        error: { kind: 'network', message: 'Could not reach cks-mcp.' },
      }),
    )
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))

    expect(screen.getByText('Could not reach cks-mcp.')).toBeInTheDocument()
  })

  it('shows a Retry button for a retriable error and calls retry() when clicked', () => {
    useSessionStore.getState().setSessionId('sess-1')
    const retry = vi.fn()
    useAiChatMock.mockReturnValue(
      aiChatState({
        error: { kind: 'network', message: 'Could not reach cks-mcp.' },
        retry,
      }),
    )
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    fireEvent.click(screen.getByRole('button', { name: /^retry$/i }))

    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('does not show a Retry button for a no_session error', () => {
    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(
      aiChatState({
        error: {
          kind: 'no_session',
          message: 'Connect to a session on the Graph page first.',
        },
      }),
    )
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))

    expect(
      screen.queryByRole('button', { name: /^retry$/i }),
    ).not.toBeInTheDocument()
  })

  it('navigates to /chat when "Open full Chat" is clicked', () => {
    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(aiChatState())
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    fireEvent.click(screen.getByRole('button', { name: /open full chat/i }))

    expect(navigateMock).toHaveBeenCalledWith('/chat')
  })

  it('closes the panel via the close button', () => {
    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(aiChatState())
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    fireEvent.click(screen.getByRole('button', { name: /close panel/i }))

    expect(
      screen.getByRole('button', { name: /quick ai/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(/ask anything/i),
    ).not.toBeInTheDocument()
  })
})
