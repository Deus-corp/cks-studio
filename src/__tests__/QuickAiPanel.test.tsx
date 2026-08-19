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
    continueTruncated: vi.fn(),
    clearChat: vi.fn(),
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

  describe('clear chat confirmation (bug #2)', () => {
    // jsdom doesn't implement window.confirm by default -- assign a
    // stub directly rather than vi.spyOn (which requires the property
    // to already exist as a function).
    afterEach(() => {
      // @ts-expect-error -- test cleanup only
      delete window.confirm
    })

    it('does not clear when the confirmation is declined', () => {
      useSessionStore.getState().setSessionId('sess-1')
      const clearChat = vi.fn()
      window.confirm = vi.fn(() => false)
      useAiChatMock.mockReturnValue(
        aiChatState({
          turns: [{ role: 'user', text: 'Hi' }],
          clearChat,
        }),
      )
      renderPanel()

      fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
      fireEvent.click(screen.getByTitle('Clear chat history for this session'))

      expect(window.confirm).toHaveBeenCalledWith(
        "Clear this session's chat history?",
      )
      expect(clearChat).not.toHaveBeenCalled()
    })

    it('clears once the confirmation is accepted', () => {
      useSessionStore.getState().setSessionId('sess-1')
      const clearChat = vi.fn()
      window.confirm = vi.fn(() => true)
      useAiChatMock.mockReturnValue(
        aiChatState({
          turns: [{ role: 'user', text: 'Hi' }],
          clearChat,
        }),
      )
      renderPanel()

      fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
      fireEvent.click(screen.getByTitle('Clear chat history for this session'))

      expect(clearChat).toHaveBeenCalledTimes(1)
    })

    it('does not prompt at all when there is no history to clear', () => {
      useSessionStore.getState().setSessionId('sess-1')
      const clearChat = vi.fn()
      window.confirm = vi.fn(() => true)
      useAiChatMock.mockReturnValue(aiChatState({ turns: [], clearChat }))
      renderPanel()

      fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
      // Disabled when there's nothing to clear -- fireEvent.click on a
      // disabled button is a no-op in the DOM, matching real behavior.
      fireEvent.click(screen.getByTitle('Clear chat history for this session'))

      expect(window.confirm).not.toHaveBeenCalled()
      expect(clearChat).not.toHaveBeenCalled()
    })
  })
})

describe('QuickAiPanel — per-message actions', () => {
  it("shows a Retry action for the trailing user turn that calls retry() (not send(), so it can't duplicate the turn)", () => {
    useSessionStore.getState().setSessionId('sess-1')
    const retry = vi.fn()
    useAiChatMock.mockReturnValue(
      aiChatState({
        turns: [{ role: 'user', text: 'list open ADRs' }],
        retry,
      }),
    )
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('does not show a Retry action once the last turn is the assistant reply (nothing to retry without duplicating)', () => {
    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(
      aiChatState({
        turns: [
          { role: 'user', text: 'hi' },
          { role: 'assistant', text: 'hello there' },
        ],
      }),
    )
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))

    expect(screen.queryAllByRole('button', { name: /retry/i })).toHaveLength(0)
  })
})

describe('QuickAiPanel — auto-scroll', () => {
  // jsdom has no layout engine, so scrollIntoView must be stubbed --
  // useAutoScrollToLatest calls it on the last-turn ref whenever the
  // panel's turn count grows.
  it('calls scrollIntoView when a new message arrives', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(
      aiChatState({ turns: [{ role: 'user', text: 'hi' }] }),
    )
    const { rerender } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    scrollIntoView.mockClear()

    useAiChatMock.mockReturnValue(
      aiChatState({
        turns: [
          { role: 'user', text: 'hi' },
          { role: 'assistant', text: 'hello there' },
        ],
      }),
    )
    rerender(
      <MemoryRouter>
        <QuickAiPanel />
      </MemoryRouter>,
    )

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    })
  })

  it('calls scrollIntoView for the "thinking…" placeholder once isSending becomes true', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    useSessionStore.getState().setSessionId('sess-1')
    useAiChatMock.mockReturnValue(
      aiChatState({ turns: [{ role: 'user', text: 'hi' }], isSending: false }),
    )
    const { rerender } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /quick ai/i }))
    scrollIntoView.mockClear()

    useAiChatMock.mockReturnValue(
      aiChatState({ turns: [{ role: 'user', text: 'hi' }], isSending: true }),
    )
    rerender(
      <MemoryRouter>
        <QuickAiPanel />
      </MemoryRouter>,
    )

    expect(screen.getByText('thinking…')).toBeInTheDocument()
    expect(scrollIntoView).toHaveBeenCalled()
  })
})
