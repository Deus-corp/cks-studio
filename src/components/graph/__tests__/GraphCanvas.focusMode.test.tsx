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
})
