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
  useSessionStore.getState().setSessionId('sess-old')
  useChatStore.getState().reset()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  getFullGraphMock.mockResolvedValue({ objects: [], relations: [] })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAiChat — session switch on tool-created session (bug #2)', () => {
  it('switches the connected session when validate_knowledge creates a new one', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({
        reply: 'Created a five-node graph.',
        tool_calls: [
          {
            name: 'validate_knowledge',
            arguments: { json_data: '{}' },
            result: { valid: true, session_id: 'sess-new' },
            is_error: false,
          },
        ],
      }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('create a five-node graph')
    })

    await waitFor(() => {
      expect(useSessionStore.getState().sessionId).toBe('sess-new')
    })
    expect(getFullGraphMock).toHaveBeenCalledWith('sess-new')
    expect(getFullGraphMock).not.toHaveBeenCalledWith('sess-old')
  })

  it('switches on construct_knowledge the same way', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({
        tool_calls: [
          {
            name: 'construct_knowledge',
            arguments: {},
            result: { session_id: 'sess-constructed' },
            is_error: false,
          },
        ],
      }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('build me a graph about cats')
    })

    await waitFor(() => {
      expect(useSessionStore.getState().sessionId).toBe('sess-constructed')
    })
  })

  it('does not switch when the tool call reports the same session_id already connected', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({
        tool_calls: [
          {
            name: 'validate_knowledge',
            arguments: { session_id: 'sess-old' },
            result: { valid: true, session_id: 'sess-old' },
            is_error: false,
          },
        ],
      }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('validate this')
    })

    expect(useSessionStore.getState().sessionId).toBe('sess-old')
    // Not a graph-mutating tool and no new session -- no refetch at all.
    expect(getFullGraphMock).not.toHaveBeenCalled()
  })

  it('ignores a session_id from a failed tool call', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({
        tool_calls: [
          {
            name: 'validate_knowledge',
            arguments: {},
            result: {
              error: 'invalid_json',
              session_id: 'sess-should-not-switch',
            },
            is_error: true,
          },
        ],
      }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('create something broken')
    })

    expect(useSessionStore.getState().sessionId).toBe('sess-old')
  })

  it('still does the normal mutated-graph refetch when no new session is created', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({
        tool_calls: [
          {
            name: 'evolve_knowledge',
            arguments: { session_id: 'sess-old' },
            result: { evolved: true, session_id: 'sess-old' },
            is_error: false,
          },
        ],
      }),
    )

    const { result } = renderHook(() => useAiChat())

    await act(async () => {
      await result.current.send('add a node')
    })

    expect(useSessionStore.getState().sessionId).toBe('sess-old')
    expect(getFullGraphMock).toHaveBeenCalledWith('sess-old')
  })
})
