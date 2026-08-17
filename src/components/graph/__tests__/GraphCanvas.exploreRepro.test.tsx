import { act, cleanup, render } from '@testing-library/react'
import type * as xyflow from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { GraphCanvas } from '../GraphCanvas'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const fitViewSpy = vi.fn()
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof xyflow>('@xyflow/react')
  return {
    ...actual,
    useReactFlow: () => {
      const real = actual.useReactFlow()
      return { ...real, fitView: fitViewSpy }
    },
  }
})

beforeEach(() => {
  fitViewSpy.mockClear()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  useGraphStore.getState().setNodes([
    {
      id: 'a',
      type: 'cksNode',
      position: { x: 0, y: 0 },
      data: { label: 'A', cksType: 'Concept' },
    },
  ])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().selectNode('a')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().selectNode(null)
})

describe('GraphCanvas — repro: explore neighbourhood should not drop the selected node', () => {
  it('keeps the selected node rendered after addNodes/addEdges (simulating handleExplore)', () => {
    render(<GraphCanvas />)
    expect(
      document.querySelector('.react-flow__node[data-id="a"]'),
    ).not.toBeNull()

    // Simulate what handleExplore does: fetch a subgraph containing the
    // seed node ('a') plus a new neighbour ('b'), then merge.
    act(() => {
      useGraphStore.getState().addNodes([
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
      ])
      useGraphStore.getState().addEdges([
        {
          id: 'edge-a-b-0',
          source: 'a',
          target: 'b',
          label: 'relates_to',
        },
      ])
    })

    expect(
      document.querySelector('.react-flow__node[data-id="a"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('.react-flow__node[data-id="b"]'),
    ).not.toBeNull()
  })

  it('re-fits the viewport onto the selected node when exploring grows the graph', async () => {
    render(<GraphCanvas />)
    expect(fitViewSpy).not.toHaveBeenCalled()

    act(() => {
      useGraphStore.getState().addNodes([
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
      ])
    })

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: 'a' }] }),
    )
  })

  it('does not re-fit when the graph shrinks or nothing is selected', () => {
    render(<GraphCanvas />)

    act(() => {
      useGraphStore.getState().selectNode(null)
      useGraphStore.getState().addNodes([
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
      ])
    })

    expect(fitViewSpy).not.toHaveBeenCalled()
  })
})
