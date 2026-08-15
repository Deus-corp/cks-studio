// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/services/sessionStore'
import type { GraphRegistryEntry } from '@/shared/types/graph'
import { GraphGallery } from '../GraphGallery'
import { useGalleryStore } from '../galleryStore'

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const {
  listGraphsMock,
  searchGraphsMock,
  checkGraphHealthMock,
  cloneGraphMock,
} = vi.hoisted(() => ({
  listGraphsMock: vi.fn(),
  searchGraphsMock: vi.fn(),
  checkGraphHealthMock: vi.fn(),
  cloneGraphMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listGraphs: listGraphsMock,
  searchGraphs: searchGraphsMock,
  checkGraphHealth: checkGraphHealthMock,
  cloneGraph: cloneGraphMock,
}))

function graph(
  overrides: Partial<GraphRegistryEntry> = {},
): GraphRegistryEntry {
  return {
    name: 'graph-a',
    session_id: 'sess-1',
    description: 'A test graph',
    tags: 'biology, demo',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    public: true,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useGalleryStore.setState({
    graphs: [],
    query: '',
    tag: '',
    publicOnly: true,
    sortBy: 'updated_desc',
    isLoading: false,
    error: null,
    health: {},
    healthLoading: {},
  })
  useSessionStore.setState({ sessionId: '' })
})

function renderGallery() {
  return render(
    <MemoryRouter>
      <GraphGallery />
    </MemoryRouter>,
  )
}

describe('GraphGallery', () => {
  it('clicking Clone calls cloneGraph, sets the session, and navigates to the graph page', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a' }),
      graph({ name: 'graph-b', tags: 'genomics' }),
    ])
    cloneGraphMock.mockResolvedValue({
      session_id: 'sess-cloned',
      version_id: 'v1',
      source_session_id: 'sess-1',
      imported_objects: 5,
      imported_relations: 4,
    })

    renderGallery()

    const cloneButtons = await screen.findAllByRole('button', {
      name: /^Clone$/,
    })
    fireEvent.click(cloneButtons[0])

    await waitFor(() => {
      expect(cloneGraphMock).toHaveBeenCalledWith({ graphName: 'graph-a' })
    })

    await waitFor(() => {
      expect(useSessionStore.getState().sessionId).toBe('sess-cloned')
    })

    await screen.findByText('Cloned into session sess-cloned')

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/')
    })
  })

  it('shows an inline error message when cloning fails', async () => {
    listGraphsMock.mockResolvedValue([graph({ name: 'graph-a' })])
    cloneGraphMock.mockRejectedValue(
      new Error('Graph "graph-a" is not registered'),
    )

    renderGallery()

    const cloneButton = await screen.findByRole('button', { name: /^Clone$/ })
    fireEvent.click(cloneButton)

    await screen.findByText('Graph "graph-a" is not registered')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('clicking a tag chip filters and reloads the gallery by that tag', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a', tags: 'biology' }),
      graph({ name: 'graph-b', tags: 'genomics' }),
    ])

    renderGallery()

    const chip = await screen.findByRole('button', { name: 'biology' })
    fireEvent.click(chip)

    await waitFor(() => {
      expect(useGalleryStore.getState().tag).toBe('biology')
    })
    // load() is called again once the tag filter changes.
    await waitFor(() => {
      expect(listGraphsMock).toHaveBeenCalledTimes(2)
    })
  })

  it('changing the sort order re-sorts the displayed cards without a reload', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'Charlie' }),
      graph({ name: 'alice' }),
      graph({ name: 'Bob' }),
    ])

    renderGallery()
    await screen.findByText('Charlie')

    const select = screen.getByLabelText('Sort by')
    fireEvent.change(select, { target: { value: 'name_asc' } })

    const headings = await screen.findAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual([
      'alice',
      'Bob',
      'Charlie',
    ])
    // Sorting is purely client-side.
    expect(listGraphsMock).toHaveBeenCalledTimes(1)
  })

  it('shows a "Forked from" badge for a cloned graph and hides it otherwise', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'proj-a' }),
      graph({ name: 'proj-a-fork', source_graph_name: 'proj-a' }),
    ])

    renderGallery()

    await screen.findByText('Forked from proj-a', { exact: false })
    const originalCard = (await screen.findByText('proj-a')).closest('div')
    expect(originalCard?.textContent).not.toContain('Forked from')
  })

  it('clicking the "Forked from" badge searches for the source graph by name', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'proj-a-fork', source_graph_name: 'proj-a' }),
    ])
    searchGraphsMock.mockResolvedValue([graph({ name: 'proj-a' })])

    renderGallery()

    const badge = await screen.findByRole('button', {
      name: /Forked from proj-a/,
    })
    fireEvent.click(badge)

    await waitFor(() => {
      expect(useGalleryStore.getState().query).toBe('proj-a')
    })
    await waitFor(() => {
      expect(searchGraphsMock).toHaveBeenCalledWith(
        'proj-a',
        expect.objectContaining({ publicOnly: true }),
      )
    })
  })
})
