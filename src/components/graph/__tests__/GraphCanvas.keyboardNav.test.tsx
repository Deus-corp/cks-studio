// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { GraphCanvas } from '../GraphCanvas'

// ReactFlow measures its container via ResizeObserver, which jsdom doesn't
// implement -- without a stub, mounting <ReactFlow> throws (same stub as
// GraphCanvas.focusMode.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  // Three nodes laid out left-to-right so ArrowRight/ArrowLeft have an
  // unambiguous nearest neighbour in each direction.
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
  useGraphStore.getState().setEdges([])
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().clearMultiSelect()
  useGraphStore.getState().selectNode(null)
})

function getNodeEl(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${id}"]`,
  )
  if (!el) throw new Error(`node ${id} not rendered`)
  return el
}

describe('GraphCanvas — keyboard navigation', () => {
  it('ArrowRight from the first node moves DOM focus to the next node to the right', async () => {
    render(<GraphCanvas />)

    await waitFor(() => getNodeEl('a'))
    getNodeEl('a').focus()
    expect(document.activeElement).toBe(getNodeEl('a'))

    fireEvent.keyDown(getNodeEl('a'), { key: 'ArrowRight' })

    expect(document.activeElement).toBe(getNodeEl('b'))
  })

  it('ArrowLeft from the last node moves focus back to the previous node', async () => {
    render(<GraphCanvas />)

    await waitFor(() => getNodeEl('c'))
    getNodeEl('c').focus()

    fireEvent.keyDown(getNodeEl('c'), { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(getNodeEl('b'))
  })

  it('arrow key with no node focused jumps to the first node', async () => {
    render(<GraphCanvas />)
    await waitFor(() => getNodeEl('a'))

    // Focus the pane container itself, not a node -- simulates focus
    // having just entered the canvas via Tab without yet landing on a
    // specific node.
    const container = screen.getAllByRole('application')[0]
    container.focus()

    fireEvent.keyDown(container, { key: 'ArrowRight' })

    expect(document.activeElement).toBe(getNodeEl('a'))
  })

  it('Enter on a focused node selects it (calls selectNode)', async () => {
    render(<GraphCanvas />)
    await waitFor(() => getNodeEl('b'))
    getNodeEl('b').focus()

    fireEvent.keyDown(getNodeEl('b'), { key: 'Enter' })

    expect(useGraphStore.getState().selectedNodeId).toBe('b')
  })

  it('Space on a focused node selects it', async () => {
    render(<GraphCanvas />)
    await waitFor(() => getNodeEl('a'))
    getNodeEl('a').focus()

    fireEvent.keyDown(getNodeEl('a'), { key: ' ' })

    expect(useGraphStore.getState().selectedNodeId).toBe('a')
  })

  it('Ctrl+Enter on a focused node toggles it into the multi-select set', async () => {
    render(<GraphCanvas />)
    await waitFor(() => getNodeEl('a'))
    getNodeEl('a').focus()

    fireEvent.keyDown(getNodeEl('a'), {
      key: 'Enter',
      ctrlKey: true,
    })

    expect(useGraphStore.getState().multiSelectedIds.has('a')).toBe(true)
  })
})
