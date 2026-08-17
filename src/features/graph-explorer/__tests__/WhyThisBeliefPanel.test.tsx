// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/services/sessionStore'
import { useGraphStore } from '../graphExplorerStore'
import { WhyThisBeliefPanel } from '../WhyThisBeliefPanel'

const { explainKnowledgeMock } = vi.hoisted(() => ({
  explainKnowledgeMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  explainKnowledge: explainKnowledgeMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useSessionStore.getState().setSessionId('')
  useGraphStore.setState({ graphVersion: 0 })
})

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
})
