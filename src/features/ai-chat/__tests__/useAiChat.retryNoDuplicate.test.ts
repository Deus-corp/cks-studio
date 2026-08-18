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
    reply: 'done',
    tool_calls: [],
    messages: [],
    ...overrides,
  }
}

beforeEach(() => {
  useSessionStore.getState().setSessionId('sess-retry')
  useChatStore.getState().reset()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAiChat retry (regression: no duplicated user turn)', () => {
  it('does not append a second user turn when retrying after a hard error', async () => {
    aiChatMock.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('retry me')
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.turns).toHaveLength(1)
    expect(result.current.turns[0].role).toBe('user')

    aiChatMock.mockResolvedValue(baseResult({ reply: 'ok now' }))
    await act(async () => {
      await result.current.retry()
    })

    const userTurns = result.current.turns.filter((t) => t.role === 'user')
    expect(userTurns).toHaveLength(1)
    expect(result.current.turns).toHaveLength(2)
  })

  it('retry is a no-op once the retried turn has succeeded (trailing turn is assistant)', async () => {
    aiChatMock.mockResolvedValueOnce(baseResult({ reply: 'ok' }))
    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('one message')
    })
    expect(result.current.turns).toHaveLength(2)
    expect(aiChatMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.retry()
    })

    // Trailing turn is now 'assistant' -- retry() must not resend.
    expect(aiChatMock).toHaveBeenCalledTimes(1)
    expect(result.current.turns).toHaveLength(2)
  })
})
