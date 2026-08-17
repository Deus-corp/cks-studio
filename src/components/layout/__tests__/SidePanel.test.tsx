// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { SidePanel } from '../SidePanel'

afterEach(() => {
  cleanup()
  useGraphStore.setState({ nodes: [], edges: [] })
})

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'plant-1',
    type: 'cksNode',
    position: { x: 0, y: 0 },
    data: {
      label: 'Sunflower',
      cksType: 'Plant',
      structure: { description: 'A tall flowering plant' },
    },
    ...overrides,
  }
}

describe('SidePanel', () => {
  it('shows a placeholder when no node is selected', () => {
    render(<SidePanel node={null} />)
    expect(screen.getByText(/click a node to inspect/i)).toBeInTheDocument()
  })

  it('always renders Overview with id, type, and name for a regular object', () => {
    const node = makeNode()
    render(<SidePanel node={node} />)

    expect(screen.getByText('Sunflower')).toBeInTheDocument()
    expect(screen.getByText('Plant')).toBeInTheDocument()
    expect(screen.getByText('plant-1')).toBeInTheDocument()
    expect(screen.getByText(/a tall flowering plant/i)).toBeInTheDocument()
  })

  it('keeps Overview visible and adds a Pipeline section for a node with transition_log, instead of replacing identity info', () => {
    const node = makeNode({
      data: {
        label: 'Sunflower',
        cksType: 'Plant',
        structure: {
          description: 'A tall flowering plant',
          current_status: 'awaiting_review',
          transition_log: [
            {
              agent: 'ResearcherAgent',
              action: 'research',
              transitioned_to: 'awaiting_review',
            },
          ],
        },
      },
    })
    render(<SidePanel node={node} />)

    // Overview fields still present.
    expect(screen.getByText('Sunflower')).toBeInTheDocument()
    expect(screen.getByText('plant-1')).toBeInTheDocument()
    expect(screen.getByText(/a tall flowering plant/i)).toBeInTheDocument()

    // Pipeline section present and open by default.
    expect(
      screen.getByRole('button', { name: /pipeline \/ transitions/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('ResearcherAgent')).toBeInTheDocument()
    expect(screen.getByText('awaiting review')).toBeInTheDocument()
  })

  it('shows an Agent Findings section when a ReasoningNode targets the selected node', () => {
    const node = makeNode()
    const reasoningNode: Node = {
      id: 'reasoning-1',
      type: 'cksNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Finding about Sunflower',
        cksType: 'ReasoningNode',
        structure: {
          kind: 'observation',
          agent: 'ResearcherAgent',
          model: 'claude-sonnet-5',
          content: 'Sunflowers track the sun during the day.',
          object_id: 'plant-1',
        },
      },
    }
    useGraphStore.setState({ nodes: [node, reasoningNode], edges: [] })

    render(<SidePanel node={node} />)

    fireEvent.click(
      screen.getByRole('button', { name: /agent findings \/ research/i }),
    )

    expect(screen.getByText('Finding about Sunflower')).toBeInTheDocument()
    expect(screen.getByText(/researcheragent/i)).toBeInTheDocument()
    expect(
      screen.getByText(/sunflowers track the sun during the day/i),
    ).toBeInTheDocument()
  })

  it('shows no Inference section when there is no inference chain for the node', () => {
    const node = makeNode()
    useGraphStore.setState({ nodes: [node], edges: [] })

    render(<SidePanel node={node} />)

    expect(
      screen.queryByRole('button', { name: /inference/i }),
    ).not.toBeInTheDocument()
  })

  it('shows an Inference section with an empty state when the node is an InferenceStep with no premises', () => {
    const node = makeNode({
      id: 'step-1',
      data: {
        label: 'Step 1',
        cksType: 'InferenceStep',
        structure: { operator: 'modus_ponens', confidence: 0.9 },
      },
    })
    useGraphStore.setState({ nodes: [node], edges: [] })

    render(<SidePanel node={node} />)

    fireEvent.click(screen.getByRole('button', { name: /^inference$/i }))
    expect(screen.getByText('modus_ponens')).toBeInTheDocument()
  })

  it('hides the Provenance section entirely when there is no provenance data', () => {
    const node = makeNode()
    useGraphStore.setState({ nodes: [node], edges: [] })

    render(<SidePanel node={node} />)

    expect(
      screen.queryByRole('button', { name: /provenance \/ verification/i }),
    ).not.toBeInTheDocument()
  })

  it('toggles a collapsible section open and closed on click', () => {
    const node = makeNode({
      data: {
        label: 'Sunflower',
        cksType: 'Plant',
        structure: {
          current_status: 'resolved',
          transition_log: [
            {
              agent: 'ReviewerAgent',
              action: 'review',
              transitioned_to: 'resolved',
            },
          ],
        },
      },
    })
    render(<SidePanel node={node} />)

    const toggle = screen.getByRole('button', {
      name: /pipeline \/ transitions/i,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ReviewerAgent')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('ReviewerAgent')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ReviewerAgent')).toBeInTheDocument()
  })
})
