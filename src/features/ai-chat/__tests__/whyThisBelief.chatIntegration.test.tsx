// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { WhyThisBeliefPanel } from '@/features/graph-explorer/WhyThisBeliefPanel'
import type { AiChatResult } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type { ExplainInferenceResult } from '@/shared/types/graph'
import { useChatStore } from '../chatStore'
import { useAiChat } from '../useAiChat'

const { aiChatMock, getFullGraphMock, explainKnowledgeMock } = vi.hoisted(
  () => ({
    aiChatMock: vi.fn(),
    getFullGraphMock: vi.fn(),
    explainKnowledgeMock: vi.fn(),
  }),
)

vi.mock('@/services/mcpTools', async () => {
  const actual = await vi.importActual<typeof import('@/services/mcpTools')>(
    '@/services/mcpTools',
  )
  return {
    ...actual,
    aiChat: aiChatMock,
    getFullGraph: getFullGraphMock,
    explainKnowledge: explainKnowledgeMock,
  }
})

function baseResult(overrides: Partial<AiChatResult> = {}): AiChatResult {
  return { reply: 'done', tool_calls: [], messages: [], ...overrides }
}

function noInference(objectId: string): ExplainInferenceResult {
  return {
    object_id: objectId,
    exists: true,
    has_inference: false,
    active_steps: [],
    superseded_steps: [],
  }
}

function withInference(objectId: string): ExplainInferenceResult {
  return {
    object_id: objectId,
    exists: true,
    has_inference: true,
    active_steps: [
      {
        step_id: 'step-rose',
        operator: 'AND',
        confidence: 0.75,
        justification: 'Added via chat',
        alternatives_considered: [],
        premises: [
          {
            object_id: 'research-rose-82cb165f4034',
            has_inference: false,
            active_steps: [],
            superseded_steps: [],
          },
        ],
      },
    ],
    superseded_steps: [],
  }
}

beforeEach(() => {
  useSessionStore.getState().setSessionId('sess-1')
  useChatStore.getState().reset()
  useGraphStore.setState({ nodes: [], edges: [], graphVersion: 0 })
  getFullGraphMock.mockResolvedValue({ nodes: [], edges: [] })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('bug #1 — "Why this belief?" reflects an InferenceStep just added via Chat', () => {
  it('bumps graphVersion after a chat turn whose tool_calls include evolve_knowledge', async () => {
    aiChatMock.mockResolvedValue(
      baseResult({
        reply: 'Added the InferenceStep for rose.',
        tool_calls: [
          {
            name: 'evolve_knowledge',
            arguments: {},
            result: { evolved: true, version_id: 'v2', session_id: 'sess-1' },
            is_error: false,
          },
        ],
      }),
    )

    const { result } = renderHook(() => useAiChat())
    const versionBefore = useGraphStore.getState().graphVersion

    await act(async () => {
      await result.current.send('add inference step for rose')
    })

    expect(getFullGraphMock).toHaveBeenCalledWith('sess-1')
    expect(useGraphStore.getState().graphVersion).toBeGreaterThan(versionBefore)
  })

  it('end-to-end: WhyThisBeliefPanel, left open, shows the InferenceStep once the chat turn completes', async () => {
    // 1. Panel starts open on 'rose' with no inference chain yet.
    explainKnowledgeMock.mockResolvedValue(noInference('rose'))
    render(
      <WhyThisBeliefPanel selectedNodeId="rose" selectedNodeLabel="Роза" />,
    )
    await act(async () => {
      screen.getByRole('button', { name: /why this belief\?/i }).click()
    })
    await screen.findByText(/no inference chain found for this node/i)

    // 2. A separate chat turn (e.g. Quick AI) adds the InferenceStep --
    // simulated the same way useAiChat.attempt() drives it.
    explainKnowledgeMock.mockResolvedValue(withInference('rose'))
    aiChatMock.mockResolvedValue(
      baseResult({
        reply: 'Added the InferenceStep for rose.',
        tool_calls: [
          {
            name: 'evolve_knowledge',
            arguments: {
              operations: [
                {
                  type: 'add_object',
                  identity: { id: 'step-rose', type: 'InferenceStep' },
                  structure: {
                    conclusion: 'rose',
                    premises: ['research-rose-82cb165f4034'],
                  },
                },
              ],
            },
            result: { evolved: true, version_id: 'v2', session_id: 'sess-1' },
            is_error: false,
          },
        ],
      }),
    )
    const { result: chat } = renderHook(() => useAiChat())
    await act(async () => {
      await chat.current.send('add inference step for rose')
    })

    // 3. Without needing to close/reopen or reselect the node, the
    // still-open panel should now show the newly added step.
    expect(await screen.findByText('step-rose')).toBeInTheDocument()
    expect(screen.getByText('Added via chat')).toBeInTheDocument()
  })
})
