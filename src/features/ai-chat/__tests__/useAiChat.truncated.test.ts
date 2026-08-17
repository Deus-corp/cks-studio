// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, renderHook } from '@testing-library/react'
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

const ITERATION_LIMIT_REPLY =
  'Reached the tool-call iteration limit without a final answer.'

beforeEach(() => {
  useSessionStore.getState().setSessionId('sess-1')
  useChatStore.getState().reset()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  getFullGraphMock.mockResolvedValue({ objects: [], relations: [] })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAiChat — tool-call iteration limit retry/continue (bug #4)', () => {
  it('marks the resulting turn as truncated when the backend sends truncated: true', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({ reply: ITERATION_LIMIT_REPLY, truncated: true }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('do something long')
    })

    const last = result.current.turns[result.current.turns.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.truncated).toBe(true)
  })

  it('falls back to detecting truncation by reply text for an older backend without the flag', async () => {
    aiChatMock.mockResolvedValue(baseResult({ reply: ITERATION_LIMIT_REPLY }))

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('do something long')
    })

    const last = result.current.turns[result.current.turns.length - 1]
    expect(last.truncated).toBe(true)
  })

  it('does not mark a normal final reply as truncated', async () => {
    aiChatMock.mockResolvedValue(baseResult({ reply: 'All done!' }))

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('do a normal thing')
    })

    const last = result.current.turns[result.current.turns.length - 1]
    expect(last.truncated).toBeFalsy()
  })

  it('continueTruncated resends the transcript without duplicating the user turn', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({ reply: ITERATION_LIMIT_REPLY, truncated: true }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('do something long')
    })

    expect(aiChatMock).toHaveBeenCalledTimes(1)
    const userTurnsBefore = result.current.turns.filter(
      (t) => t.role === 'user',
    ).length
    expect(userTurnsBefore).toBe(1)

    aiChatMock.mockResolvedValue(baseResult({ reply: 'Now finished.' }))

    await act(async () => {
      await result.current.continueTruncated()
    })

    expect(aiChatMock).toHaveBeenCalledTimes(2)
    const userTurnsAfter = result.current.turns.filter(
      (t) => t.role === 'user',
    ).length
    // continueTruncated must not append a second copy of the user's
    // message -- only the trailing assistant turn changes.
    expect(userTurnsAfter).toBe(1)
    expect(result.current.turns[result.current.turns.length - 1].text).toBe(
      'Now finished.',
    )
  })

  it('continueTruncated is a no-op if the last turn is not truncated', async () => {
    aiChatMock.mockResolvedValue(baseResult({ reply: 'All done!' }))

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('do a normal thing')
    })

    expect(aiChatMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.continueTruncated()
    })

    expect(aiChatMock).toHaveBeenCalledTimes(1)
  })
})
