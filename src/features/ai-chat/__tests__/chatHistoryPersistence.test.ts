// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import type { AiChatResult } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { useChatStore } from '../chatStore'
import { useAiChat } from '../useAiChat'

const { aiChatMock, getFullGraphMock } = vi.hoisted(() => ({
  aiChatMock: vi.fn(),
  getFullGraphMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', async () => {
  const actual = await vi.importActual<typeof import('@/services/mcpTools')>(
    '@/services/mcpTools',
  )
  return {
    ...actual,
    aiChat: aiChatMock,
    getFullGraph: getFullGraphMock,
  }
})

function baseResult(overrides: Partial<AiChatResult> = {}): AiChatResult {
  return {
    reply: 'ack',
    tool_calls: [],
    messages: [],
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  useSessionStore.getState().setSessionId('')
  useChatStore.setState({
    activeSessionId: '',
    historyBySessionId: {},
    turns: [],
    rawMessages: [],
    error: null,
  })
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  aiChatMock.mockReset()
  getFullGraphMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('chat history persistence across session switches', () => {
  it("keeps each session's transcript separate and restores it on switch-back", async () => {
    useSessionStore.getState().setSessionId('session-a')
    const { result, rerender } = renderHook(() => useAiChat())

    aiChatMock.mockResolvedValueOnce(baseResult({ reply: 'reply-a' }))
    await act(async () => {
      await result.current.send('hello from a')
    })
    await waitFor(() => expect(result.current.turns).toHaveLength(2))
    expect(result.current.turns[0].text).toBe('hello from a')
    expect(result.current.turns[1].text).toBe('reply-a')

    // Switch to a different session -- the chat should NOT show
    // session-a's transcript (this was the reported bug: switching
    // sessions reset chat to empty instead of loading the *new*
    // session's own history).
    act(() => {
      useSessionStore.getState().setSessionId('session-b')
    })
    rerender()
    await waitFor(() => expect(result.current.turns).toHaveLength(0))

    aiChatMock.mockResolvedValueOnce(baseResult({ reply: 'reply-b' }))
    await act(async () => {
      await result.current.send('hello from b')
    })
    await waitFor(() => expect(result.current.turns).toHaveLength(2))
    expect(result.current.turns[0].text).toBe('hello from b')

    // Switch back to session-a -- its earlier transcript must be
    // restored, not lost.
    act(() => {
      useSessionStore.getState().setSessionId('session-a')
    })
    rerender()
    await waitFor(() => expect(result.current.turns).toHaveLength(2))
    expect(result.current.turns[0].text).toBe('hello from a')
    expect(result.current.turns[1].text).toBe('reply-a')
  })

  it("clearChat only clears the active session's history", async () => {
    useSessionStore.getState().setSessionId('session-a')
    const { result, rerender } = renderHook(() => useAiChat())

    aiChatMock.mockResolvedValueOnce(baseResult({ reply: 'reply-a' }))
    await act(async () => {
      await result.current.send('hello from a')
    })
    await waitFor(() => expect(result.current.turns).toHaveLength(2))

    act(() => {
      useSessionStore.getState().setSessionId('session-b')
    })
    rerender()
    aiChatMock.mockResolvedValueOnce(baseResult({ reply: 'reply-b' }))
    await act(async () => {
      await result.current.send('hello from b')
    })
    await waitFor(() => expect(result.current.turns).toHaveLength(2))

    act(() => {
      result.current.clearChat()
    })
    await waitFor(() => expect(result.current.turns).toHaveLength(0))

    // session-a's history must be untouched.
    act(() => {
      useSessionStore.getState().setSessionId('session-a')
    })
    rerender()
    await waitFor(() => expect(result.current.turns).toHaveLength(2))
  })
})
