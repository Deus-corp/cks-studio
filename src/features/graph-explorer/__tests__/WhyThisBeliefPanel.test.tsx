// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/services/sessionStore'
import { useGraphStore } from '../graphExplorerStore'
import { WhyThisBeliefPanel } from '../WhyThisBeliefPanel'

const {
  explainKnowledgeMock,
  listInferenceConflictsMock,
  arbitrateInferenceConflictMock,
} = vi.hoisted(() => ({
  explainKnowledgeMock: vi.fn(),
  listInferenceConflictsMock: vi.fn(),
  arbitrateInferenceConflictMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  explainKnowledge: explainKnowledgeMock,
  listInferenceConflicts: listInferenceConflictsMock,
  arbitrateInferenceConflict: arbitrateInferenceConflictMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useSessionStore.getState().setSessionId('')
  useGraphStore.setState({ graphVersion: 0 })
})

// listInferenceConflicts is only called when there's at least one active
// step (see useExplainInference) -- default to an empty, non-erroring
// response so single-step tests written before this feature don't need
// to know about it.
listInferenceConflictsMock.mockResolvedValue({ conflicts: [], count: 0 })

describe('WhyThisBeliefPanel', () => {
  it('renders a disabled tab with a "select a node" label when no node is selected', () => {
    render(<WhyThisBeliefPanel selectedNodeId={null} />)

    const button = screen.getByRole('button', { name: /select a node/i })
    expect(button).toBeDisabled()
    expect(explainKnowledgeMock).not.toHaveBeenCalled()
  })

  it('is enabled once a node is selected but does not fetch until opened', () => {
    useSessionStore.getState().setSessionId('sess-1')
    render(<WhyThisBeliefPanel selectedNodeId="node-a" />)

    expect(
      screen.getByRole('button', { name: /why this belief\?/i }),
    ).toBeEnabled()
    expect(explainKnowledgeMock).not.toHaveBeenCalled()
  })

  it('fetches and shows a loading state on open, then renders the result', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    let resolvePromise: (v: unknown) => void = () => {}
    explainKnowledgeMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      }),
    )

    render(
      <WhyThisBeliefPanel selectedNodeId="node-a" selectedNodeLabel="Node A" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /why this belief\?/i }))

    expect(screen.getByText(/loading explanation/i)).toBeInTheDocument()
    expect(explainKnowledgeMock).toHaveBeenCalledWith('sess-1', 'node-a')

    resolvePromise({
      object_id: 'node-a',
      exists: true,
      has_inference: true,
      active_steps: [
        {
          step_id: 'step-1',
          operator: 'AND',
          confidence: 0.9,
          justification: 'Because of premises',
          alternatives_considered: [],
          premises: [{ object_id: 'fact-1', has_inference: false }],
        },
      ],
      superseded_steps: [],
    })

    expect(await screen.findByText('step-1')).toBeInTheDocument()
    expect(screen.getByText('Because of premises')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('fact-1')).toBeInTheDocument()
  })

  it('shows an error state when explainKnowledge fails', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockRejectedValue(
      new Error('no explain_inference capability'),
    )

    render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
    fireEvent.click(screen.getByRole('button', { name: /why this belief\?/i }))

    expect(
      await screen.findByText('no explain_inference capability'),
    ).toBeInTheDocument()
  })

  it('shows a friendly empty state when there is no inference chain', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue({
      object_id: 'node-a',
      exists: true,
      has_inference: false,
      active_steps: [],
      superseded_steps: [],
    })

    render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
    fireEvent.click(screen.getByRole('button', { name: /why this belief\?/i }))

    expect(
      await screen.findByText(/no inference chain found for this node/i),
    ).toBeInTheDocument()
  })

  it('re-fetches when the selected node changes while the panel stays open', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue({
      object_id: 'node-a',
      exists: true,
      has_inference: false,
      active_steps: [],
      superseded_steps: [],
    })

    const { rerender } = render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
    fireEvent.click(screen.getByRole('button', { name: /why this belief\?/i }))

    await screen.findByText(/no inference chain found for this node/i)
    expect(explainKnowledgeMock).toHaveBeenCalledWith('sess-1', 'node-a')

    explainKnowledgeMock.mockClear()
    rerender(<WhyThisBeliefPanel selectedNodeId="node-b" />)

    expect(explainKnowledgeMock).toHaveBeenCalledWith('sess-1', 'node-b')
  })

  it('re-fetches when graphVersion bumps (e.g. an evolve_knowledge commit) while the panel stays open on the same node (bug #1)', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue({
      object_id: 'rose',
      exists: true,
      has_inference: false,
      active_steps: [],
      superseded_steps: [],
    })

    render(<WhyThisBeliefPanel selectedNodeId="rose" />)
    fireEvent.click(screen.getByRole('button', { name: /why this belief\?/i }))

    await screen.findByText(/no inference chain found for this node/i)
    expect(explainKnowledgeMock).toHaveBeenCalledTimes(1)

    // Simulate a chat turn's evolve_knowledge call adding an
    // InferenceStep for the still-selected/still-open node -- this is
    // what useAiChat.bumpGraphVersion() does after a graph-mutating
    // tool call succeeds.
    explainKnowledgeMock.mockResolvedValue({
      object_id: 'rose',
      exists: true,
      has_inference: true,
      active_steps: [
        {
          step_id: 'step-new',
          operator: 'AND',
          confidence: 0.8,
          justification: 'Newly added via chat',
          alternatives_considered: [],
          premises: [
            { object_id: 'research-rose-82cb165f4034', has_inference: false },
          ],
        },
      ],
      superseded_steps: [],
    })
    act(() => {
      useGraphStore.getState().bumpGraphVersion()
    })

    expect(await screen.findByText('step-new')).toBeInTheDocument()
    expect(explainKnowledgeMock).toHaveBeenCalledTimes(2)
  })

  it('closes the panel via the close button', async () => {
    useSessionStore.getState().setSessionId('sess-1')
    explainKnowledgeMock.mockResolvedValue({
      object_id: 'node-a',
      exists: true,
      has_inference: false,
      active_steps: [],
      superseded_steps: [],
    })

    render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
    fireEvent.click(screen.getByRole('button', { name: /why this belief\?/i }))
    await screen.findByText(/no inference chain found for this node/i)

    fireEvent.click(screen.getByRole('button', { name: /close panel/i }))

    expect(
      screen.getByRole('button', { name: /why this belief\?/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/no inference chain found for this node/i),
    ).not.toBeInTheDocument()
  })

  describe('belief revision', () => {
    const twoConflictingSteps = {
      object_id: 'node-a',
      exists: true,
      has_inference: true,
      active_steps: [
        {
          step_id: 'step-low',
          operator: 'OR',
          confidence: 0.4,
          justification: 'Weaker path',
          alternatives_considered: [],
          premises: [],
        },
        {
          step_id: 'step-high',
          operator: 'AND',
          confidence: 0.9,
          justification: 'Stronger path',
          alternatives_considered: [],
          premises: [],
        },
      ],
      superseded_steps: [],
    }

    it('badges the highest-confidence step as "Most supported" regardless of array order', async () => {
      useSessionStore.getState().setSessionId('sess-1')
      explainKnowledgeMock.mockResolvedValue(twoConflictingSteps)

      render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
      fireEvent.click(
        screen.getByRole('button', { name: /why this belief\?/i }),
      )

      await screen.findByText('Most supported')
      const badge = screen.getByText('Most supported')
      // The badge sits inside step-high's card, not step-low's -- confirm
      // by walking up to the nearest card and checking its step_id text.
      const card = badge.closest('div.rounded')
      expect(card).not.toBeNull()
      expect(card?.textContent).toContain('step-high')
      expect(card?.textContent).not.toContain('step-low')
    })

    it('does not show a "Most supported" badge or conflict section for a single active step', async () => {
      useSessionStore.getState().setSessionId('sess-1')
      explainKnowledgeMock.mockResolvedValue({
        object_id: 'node-a',
        exists: true,
        has_inference: true,
        active_steps: [twoConflictingSteps.active_steps[1]],
        superseded_steps: [],
      })

      render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
      fireEvent.click(
        screen.getByRole('button', { name: /why this belief\?/i }),
      )

      await screen.findByText('step-high')
      expect(screen.queryByText('Most supported')).not.toBeInTheDocument()
      expect(screen.queryByText('Resolve conflict')).not.toBeInTheDocument()
    })

    it('shows a "Resolve conflict" section for multiple active steps and applies the picked winner', async () => {
      useSessionStore.getState().setSessionId('sess-1')
      explainKnowledgeMock.mockResolvedValue(twoConflictingSteps)
      arbitrateInferenceConflictMock.mockResolvedValue({
        session_id: 'sess-1',
        conclusion_id: 'node-a',
        conflict: true,
        active_steps: twoConflictingSteps.active_steps,
        decision: {
          winner_step_id: 'step-low',
          reasoning: 'Caller-supplied resolution.',
          runner_up_ids: ['step-high'],
          confidence_in_decision: null,
        },
        decision_source: 'caller',
        commit_result: {
          evolved: true,
          serialized: '{}',
          operations_applied: 1,
          version_id: 'v2',
          session_id: 'sess-1',
        },
      })

      render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
      fireEvent.click(
        screen.getByRole('button', { name: /why this belief\?/i }),
      )
      await screen.findByRole('button', { name: /^resolve conflict$/i })

      // Pick the weaker step as the winner instead of the default
      // (highest-confidence) selection, then submit.
      fireEvent.click(screen.getByDisplayValue('step-low'))
      fireEvent.click(
        screen.getByRole('button', { name: /^resolve conflict$/i }),
      )

      expect(arbitrateInferenceConflictMock).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        conclusionId: 'node-a',
        winnerId: 'step-low',
        reasoning: undefined,
        commit: true,
      })

      await screen.findByText(/applied — refreshing/i)
      // A successful resolution bumps graphVersion, which the panel's
      // own effect is keyed on -- confirm it actually changed rather
      // than asserting a second explainKnowledge call (timing of the
      // effect's re-run is not this test's concern).
      expect(useGraphStore.getState().graphVersion).toBe(1)
    })

    it('shows an inline error when resolving a conflict fails at the business level', async () => {
      useSessionStore.getState().setSessionId('sess-1')
      explainKnowledgeMock.mockResolvedValue(twoConflictingSteps)
      arbitrateInferenceConflictMock.mockResolvedValue({
        error: 'invalid_parameter',
        message: "winner_id 'step-low' is not among the active steps.",
      })

      render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
      fireEvent.click(
        screen.getByRole('button', { name: /why this belief\?/i }),
      )
      await screen.findByRole('button', { name: /^resolve conflict$/i })

      fireEvent.click(
        screen.getByRole('button', { name: /^resolve conflict$/i }),
      )

      expect(
        await screen.findByText(/not among the active steps/i),
      ).toBeInTheDocument()
      expect(useGraphStore.getState().graphVersion).toBe(0)
    })

    it('warns on a step with a stale premise and repairs it on request', async () => {
      useSessionStore.getState().setSessionId('sess-1')
      const stepWithStalePremise = {
        object_id: 'node-a',
        exists: true,
        has_inference: true,
        active_steps: [
          {
            step_id: 'step-citing',
            operator: 'AND',
            confidence: 0.8,
            justification: 'Cites another step',
            alternatives_considered: [],
            premises: [{ object_id: 'step-old', cites_step: true }],
          },
        ],
        superseded_steps: [],
      }
      explainKnowledgeMock.mockResolvedValue(stepWithStalePremise)
      listInferenceConflictsMock.mockResolvedValue({
        count: 1,
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
                message: 'step-citing cites a superseded premise',
                location: 'step-citing',
              },
            ],
          },
        ],
      })
      arbitrateInferenceConflictMock.mockResolvedValue({
        session_id: 'sess-1',
        results: [
          {
            step_id: 'step-citing',
            resolved: true,
            fixes: { 'step-old': 'step-new' },
          },
        ],
        commit_result: {
          evolved: true,
          serialized: '{}',
          operations_applied: 1,
          version_id: 'v2',
          session_id: 'sess-1',
        },
      })

      render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
      fireEvent.click(
        screen.getByRole('button', { name: /why this belief\?/i }),
      )

      expect(
        await screen.findByText(/cited premise has since been superseded/i),
      ).toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', { name: /repair stale premise/i }),
      )

      expect(arbitrateInferenceConflictMock).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        stalePremiseIds: ['step-citing'],
        commit: true,
      })
      await screen.findByText(/applied — refreshing/i)
      expect(useGraphStore.getState().graphVersion).toBe(1)
    })

    it('does not crash and shows nothing extra when list_inference_conflicts fails', async () => {
      useSessionStore.getState().setSessionId('sess-1')
      explainKnowledgeMock.mockResolvedValue({
        object_id: 'node-a',
        exists: true,
        has_inference: true,
        active_steps: [twoConflictingSteps.active_steps[1]],
        superseded_steps: [],
      })
      listInferenceConflictsMock.mockRejectedValue(
        new Error('sweeper unavailable'),
      )

      render(<WhyThisBeliefPanel selectedNodeId="node-a" />)
      fireEvent.click(
        screen.getByRole('button', { name: /why this belief\?/i }),
      )

      expect(await screen.findByText('step-high')).toBeInTheDocument()
      expect(
        screen.queryByText(/cited premise has since been superseded/i),
      ).not.toBeInTheDocument()
    })
  })
})
