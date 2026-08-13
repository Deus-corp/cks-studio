// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { GraphCanvas } from '../GraphCanvas'

// ReactFlow measures its container via ResizeObserver, which jsdom doesn't
// implement -- without a stub, mounting <ReactFlow> throws.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  useGraphStore.getState().setNodes([
    {
      id: 'a',
      type: 'cksNode',
      position: { x: 0, y: 0 },
      data: { label: 'A', cksType: 'Concept' },
    },
    {
      id: 'b',
      type: 'cksNode',
      position: { x: 200, y: 0 },
      data: { label: 'B', cksType: 'Concept' },
    },
    {
      id: 'c',
      type: 'cksNode',
      position: { x: 400, y: 0 },
      data: { label: 'C', cksType: 'Concept' },
    },
  ])
  useGraphStore.getState().setEdges([{ id: 'a-b', source: 'a', target: 'b' }])
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().clearMultiSelect()
  useGraphStore.getState().selectNode(null)
})

describe('GraphCanvas — 2D focus mode toggle', () => {
  it('renders a Focus toggle that is off by default', () => {
    render(<GraphCanvas />)

    const toggle = screen.getByRole('button', { name: /focus/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('turns on when clicked, and back off on a second click', () => {
    render(<GraphCanvas />)

    const toggle = screen.getByRole('button', { name: /focus/i })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('dims non-related nodes and keeps the focused node + neighbors at full opacity', () => {
    render(<GraphCanvas />)

    fireEvent.click(screen.getByRole('button', { name: /focus/i }))
    fireEvent.click(screen.getByText('A'))

    // 'a' is the focused node, 'b' is its direct neighbor (a-b edge) --
    // neither should be dimmed. 'c' has no edge to 'a' and should be.
    const nodeA = screen.getByText('A').closest('.react-flow__node')
    const nodeB = screen.getByText('B').closest('.react-flow__node')
    const nodeC = screen.getByText('C').closest('.react-flow__node')

    expect(nodeA?.querySelector('div')).not.toHaveStyle({ opacity: '0.25' })
    expect(nodeB?.querySelector('div')).not.toHaveStyle({ opacity: '0.25' })
    expect(nodeC?.querySelector('div')).toHaveStyle({ opacity: '0.25' })
  })

  it('keeps the selected node highlighted after it is no longer hovered', () => {
    render(<GraphCanvas />)

    fireEvent.click(screen.getByText('A'))

    expect(useGraphStore.getState().selectedNodeId).toBe('a')
    const nodeA = screen.getByText('A').closest('.react-flow__node')
    // The persistent-highlight brightness filter (see CksNode) is applied
    // via inline style regardless of :hover/mouse position.
    expect(nodeA?.querySelector('div')).toHaveStyle({
      filter: 'brightness(1.08)',
    })
  })
})
