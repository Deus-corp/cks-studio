// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { useSessionStore } from '@/services/sessionStore'
import type { SubgraphResult } from '@/shared/types/graph'
import { GraphPage } from '../GraphPage'

// Full render through GraphPage (not just direct store calls) using a
// real graphExplorerStore and a mocked MCP layer -- this exercises the
// actual handleExplore code path (mcpTools.querySubgraph -> cksToReactFlow
// -> addNodes/addEdges) the way a user's repeated clicks would, rather
// than asserting against store mutations we construct ourselves.
const { getFullGraphMock, querySubgraphMock } = vi.hoisted(() => ({
  getFullGraphMock: vi.fn(),
  querySubgraphMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  getFullGraph: getFullGraphMock,
  querySubgraph: querySubgraphMock,
}))

// GraphPage renders GraphCanvas3D lazily; keep everything on the 2D path
// (the default) so this test doesn't need to also stub three.js/WebGL.
vi.mock('@/services/useSessionEvents', () => ({
  useSessionEvents: () => {},
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function cksObject(id: string, name: string) {
  return {
    identity: { id, name, type: 'Concept' },
    structure: {},
  }
}

const initialGraph: SubgraphResult = {
  nodes: [cksObject('a', 'Node A')],
  edges: [],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useSessionStore.getState().setSessionId('')
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().selectNode(null)
})

async function connectAndSelect() {
  getFullGraphMock.mockResolvedValue(initialGraph)
  render(
    <MemoryRouter>
      <GraphPage />
    </MemoryRouter>,
  )

  await act(async () => {
    useSessionStore.getState().setSessionId('sess-1')
    await Promise.resolve()
    await Promise.resolve()
  })

  act(() => {
    useGraphStore.getState().selectNode('a')
  })
}

describe('GraphPage — Explore neighbourhood does not drop the selected node', () => {
  it('keeps the selected node on the canvas after repeated Explore neighbourhood clicks', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    await connectAndSelect()

    expect(
      document.querySelector('.react-flow__node[data-id="a"]'),
    ).not.toBeNull()

    // Each click returns the seed node ('a') plus one brand-new neighbour
    // -- exactly what a real query_subgraph(compact_mode) response looks
    // like, and exactly the shape the reported bug lost track of.
    const responses: SubgraphResult[] = [
      {
        nodes: [cksObject('a', 'Node A'), cksObject('b', 'Node B')],
        edges: [],
      },
      {
        nodes: [cksObject('a', 'Node A'), cksObject('c', 'Node C')],
        edges: [],
      },
      {
        nodes: [cksObject('a', 'Node A'), cksObject('d', 'Node D')],
        edges: [],
      },
    ]
    for (const response of responses) {
      querySubgraphMock.mockResolvedValueOnce(response)
    }

    const exploreButton = screen.getByRole('button', {
      name: /explore neighbourhood/i,
    })

    for (let i = 0; i < responses.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        fireEvent.click(exploreButton)
        await Promise.resolve()
        await Promise.resolve()
      })

      // The selected node must survive every single explore round --
      // not just "eventually" after a tab switch or refresh.
      expect(
        document.querySelector('.react-flow__node[data-id="a"]'),
      ).not.toBeNull()
      expect(useGraphStore.getState().selectedNodeId).toBe('a')
    }

    // All neighbours accumulated -- nothing was replaced/removed.
    const finalIds = new Set(useGraphStore.getState().nodes.map((n) => n.id))
    expect(finalIds).toEqual(new Set(['a', 'b', 'c', 'd']))

    vi.unstubAllGlobals()
  })

  it('does not clear the graph when a click finds no new neighbours at either depth', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    await connectAndSelect()

    // depth=1 and depth=2 both come back with only the seed node --
    // nothing new anywhere in the neighbourhood (the "bundled
    // cks-ecosystem graph" case from the bug report).
    querySubgraphMock.mockResolvedValue({
      nodes: [cksObject('a', 'Node A')],
      edges: [],
    })

    const exploreButton = screen.getByRole('button', {
      name: /explore neighbourhood/i,
    })

    await act(async () => {
      fireEvent.click(exploreButton)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      document.querySelector('.react-flow__node[data-id="a"]'),
    ).not.toBeNull()
    expect(useGraphStore.getState().nodes.map((n) => n.id)).toEqual(['a'])
    expect(screen.getByText(/no new neighbours found/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
