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
  compareGraphsMock,
  mergeGraphsMock,
  updateGraphLifecycleMock,
} = vi.hoisted(() => ({
  listGraphsMock: vi.fn(),
  searchGraphsMock: vi.fn(),
  checkGraphHealthMock: vi.fn(),
  cloneGraphMock: vi.fn(),
  compareGraphsMock: vi.fn(),
  mergeGraphsMock: vi.fn(),
  updateGraphLifecycleMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listGraphs: listGraphsMock,
  searchGraphs: searchGraphsMock,
  checkGraphHealth: checkGraphHealthMock,
  cloneGraph: cloneGraphMock,
  compareGraphs: compareGraphsMock,
  mergeGraphs: mergeGraphsMock,
  updateGraphLifecycle: updateGraphLifecycleMock,
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

function compareResult(overrides = {}) {
  return {
    graph_a: 'graph-a',
    graph_b: 'graph-b',
    graph_a_session_id: 'sess-a',
    graph_b_session_id: 'sess-b',
    shared_object_count: 2,
    only_in_a_count: 1,
    only_in_b_count: 3,
    shared_object_ids: ['obj-1', 'obj-2'],
    only_in_a: ['obj-only-a'],
    only_in_b: ['obj-only-b-1', 'obj-only-b-2', 'obj-only-b-3'],
    differences: [],
    ...overrides,
  }
}

describe('GraphGallery — compare mode', () => {
  it('toggling compare mode shows checkboxes on cards', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a' }),
      graph({ name: 'graph-b' }),
    ])

    renderGallery()
    await screen.findByText('graph-a')

    expect(screen.queryByLabelText(/Select graph-a/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare graphs' }))

    expect(screen.getByLabelText(/Select graph-a/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Select graph-b/)).toBeInTheDocument()
  })

  it('selecting two graphs reveals the Compare selected button', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a' }),
      graph({ name: 'graph-b' }),
    ])

    renderGallery()
    await screen.findByText('graph-a')
    fireEvent.click(screen.getByRole('button', { name: 'Compare graphs' }))

    expect(
      screen.queryByRole('button', { name: 'Compare selected' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Select graph-a/))
    fireEvent.click(screen.getByLabelText(/Select graph-b/))

    expect(
      screen.getByRole('button', { name: 'Compare selected' }),
    ).toBeInTheDocument()
  })

  it('opening the compare modal runs compare_graphs and shows the diff summary', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a' }),
      graph({ name: 'graph-b' }),
    ])
    compareGraphsMock.mockResolvedValue(compareResult())

    renderGallery()
    await screen.findByText('graph-a')
    fireEvent.click(screen.getByRole('button', { name: 'Compare graphs' }))
    fireEvent.click(screen.getByLabelText(/Select graph-a/))
    fireEvent.click(screen.getByLabelText(/Select graph-b/))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))

    await waitFor(() => {
      expect(compareGraphsMock).toHaveBeenCalledWith({
        graphA: { graphName: 'graph-a' },
        graphB: { graphName: 'graph-b' },
      })
    })

    await screen.findByText('2') // shared_object_count
    expect(screen.getByText('1')).toBeInTheDocument() // only_in_a_count
    expect(screen.getByText('3')).toBeInTheDocument() // only_in_b_count
    expect(screen.getByText('obj-only-a')).toBeInTheDocument()
  })

  it('merging navigates to the new session on success', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a' }),
      graph({ name: 'graph-b' }),
    ])
    compareGraphsMock.mockResolvedValue(compareResult())
    mergeGraphsMock.mockResolvedValue({
      merged: true,
      session_id: 'sess-merged',
      version_id: 'v1',
      object_count: 6,
    })

    renderGallery()
    await screen.findByText('graph-a')
    fireEvent.click(screen.getByRole('button', { name: 'Compare graphs' }))
    fireEvent.click(screen.getByLabelText(/Select graph-a/))
    fireEvent.click(screen.getByLabelText(/Select graph-b/))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))
    await screen.findByText('Merge into new session')

    fireEvent.click(
      screen.getByRole('button', { name: 'Merge into new session' }),
    )

    await waitFor(() => {
      expect(mergeGraphsMock).toHaveBeenCalledWith({
        graphA: { graphName: 'graph-a' },
        graphB: { graphName: 'graph-b' },
        resolutions: undefined,
        registerAs: undefined,
      })
    })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open merged graph' }),
    )

    await waitFor(() => {
      expect(useSessionStore.getState().sessionId).toBe('sess-merged')
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/')
    })
  })

  it('shows conflicts and lets the user resolve all in favor of one side', async () => {
    listGraphsMock.mockResolvedValue([
      graph({ name: 'graph-a' }),
      graph({ name: 'graph-b' }),
    ])
    compareGraphsMock.mockResolvedValue(compareResult())
    mergeGraphsMock
      .mockResolvedValueOnce({
        merged: false,
        message: 'Merge conflict detected.',
        conflicts: [{ object_id: 'obj-1', target_diff: {}, source_diff: {} }],
      })
      .mockResolvedValueOnce({
        merged: true,
        session_id: 'sess-resolved',
        object_count: 4,
      })

    renderGallery()
    await screen.findByText('graph-a')
    fireEvent.click(screen.getByRole('button', { name: 'Compare graphs' }))
    fireEvent.click(screen.getByLabelText(/Select graph-a/))
    fireEvent.click(screen.getByLabelText(/Select graph-b/))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))
    await screen.findByText('Merge into new session')
    fireEvent.click(
      screen.getByRole('button', { name: 'Merge into new session' }),
    )

    await screen.findByText('Merge conflict detected.')
    expect(screen.getByText('obj-1')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Keep all from graph-a' }),
    )

    await waitFor(() => {
      expect(mergeGraphsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          resolutions: { 'obj-1': 'branch_a' },
        }),
      )
    })
    await screen.findByText(/Merged into session sess-resolved/)
  })
})
