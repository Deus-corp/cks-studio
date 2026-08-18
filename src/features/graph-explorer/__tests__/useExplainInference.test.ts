// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/services/sessionStore'
import { useExplainInference } from '../useExplainInference'

const { explainKnowledgeMock, listInferenceConflictsMock } = vi.hoisted(() => ({
  explainKnowledgeMock: vi.fn(),
  listInferenceConflictsMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  explainKnowledge: explainKnowledgeMock,
  listInferenceConflicts: listInferenceConflictsMock,
}))

const explanationWithTwoActiveSteps = {
  object_id: 'node-a',
  exists: true,
  has_inference: true,
  active_steps: [
    {
      step_id: 'step-1',
      operator: 'AND',
      confidence: 0.9,
      justification: 'First',
      alternatives_considered: [],
      premises: [],
    },
    {
      step_id: 'step-2',
      operator: 'OR',
      confidence: 0.5,
      justification: 'Second, cites step-1',
      alternatives_considered: [],
      premises: [{ object_id: 'step-1', cites_step: true }],
    },
  ],
  superseded_steps: [],
}

afterEach(() => {
  vi.clearAllMocks()
  useSessionStore.getState().setSessionId('')
})

describe('useExplainInference', () => {
  it('no-ops and clears data when there is no session or objectId', async () => {
    const { result } = renderHook(() => useExplainInference())

    await act(async () => {
      await result.current.refresh('node-a')
    })

    expect(result.current.data).toBeNull()
    expect(explainKnowledgeMock).not.toHaveBeenCalled()
    expect(listInferenceConflictsMock).not.toHaveBeenCalled()
  })

  it('fetches the explanation and does not peek conflicts when there are no active steps', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue({
      object_id: 'node-a',
      exists: true,
      has_inference: false,
      active_steps: [],
      superseded_steps: [],
    })

    const { result } = renderHook(() => useExplainInference())
    await act(async () => {
      await result.current.refresh('node-a')
    })

    expect(result.current.data?.object_id).toBe('node-a')
    expect(result.current.staleStepIds.size).toBe(0)
    expect(listInferenceConflictsMock).not.toHaveBeenCalled()
  })

  it('peeks list_inference_conflicts (non-destructively) and flags stale steps', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue(explanationWithTwoActiveSteps)
    listInferenceConflictsMock.mockResolvedValue({
      count: 2,
      conflicts: [
        {
          session_id: 'sess-1',
          version_id: 'v1',
          detected_at: '2026-08-18T00:00:00Z',
          record_id: 'rec-1',
          diagnostics: [
            {
              code: 'CKS-EXT-STALE-PREMISE',
              severity: 'warning',
              message: 'step-2 cites a superseded premise',
              location: 'step-2',
            },
            // Unrelated finding for a different step -- must not show up.
            {
              code: 'CKS-EXT-STALE-PREMISE',
              severity: 'warning',
              message: 'other',
              location: 'step-elsewhere',
            },
          ],
        },
      ],
    })

    const { result } = renderHook(() => useExplainInference())
    await act(async () => {
      await result.current.refresh('node-a')
    })

    expect(listInferenceConflictsMock).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      peek: true,
    })
    expect(result.current.staleStepIds.has('step-2')).toBe(true)
    expect(result.current.staleStepIds.has('step-elsewhere')).toBe(false)
    expect(result.current.staleStepIds.size).toBe(1)
  })

  it('does not surface an error or clear data when the conflicts peek itself fails', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue(explanationWithTwoActiveSteps)
    listInferenceConflictsMock.mockRejectedValue(
      new Error('sweeper unavailable'),
    )

    const { result } = renderHook(() => useExplainInference())
    await act(async () => {
      await result.current.refresh('node-a')
    })

    expect(result.current.error).toBeNull()
    expect(result.current.data?.object_id).toBe('node-a')
    expect(result.current.staleStepIds.size).toBe(0)
  })

  it('ignores a stale response from a superseded request (sequence guard)', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    let resolveFirst: (v: unknown) => void = () => {}
    explainKnowledgeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    explainKnowledgeMock.mockImplementationOnce(() =>
      Promise.resolve({
        object_id: 'node-b',
        exists: true,
        has_inference: false,
        active_steps: [],
        superseded_steps: [],
      }),
    )

    const { result } = renderHook(() => useExplainInference())

    let firstCall: Promise<void>
    act(() => {
      firstCall = result.current.refresh('node-a')
    })
    await act(async () => {
      await result.current.refresh('node-b')
    })

    resolveFirst({
      object_id: 'node-a',
      exists: true,
      has_inference: false,
      active_steps: [],
      superseded_steps: [],
    })
    await act(async () => {
      await firstCall
    })

    await waitFor(() => {
      expect(result.current.data?.object_id).toBe('node-b')
    })
  })
})
