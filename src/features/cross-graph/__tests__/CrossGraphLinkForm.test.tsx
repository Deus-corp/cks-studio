// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CrossGraphLinkForm } from '../CrossGraphLinkForm'

const { listGraphsMock, getFullGraphMock, linkGraphsMock } = vi.hoisted(() => ({
  listGraphsMock: vi.fn(),
  getFullGraphMock: vi.fn(),
  linkGraphsMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listGraphs: listGraphsMock,
  getFullGraph: getFullGraphMock,
  linkGraphs: linkGraphsMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CrossGraphLinkForm', () => {
  it('excludes the current session graph from the target list and loads its objects on selection', async () => {
    listGraphsMock.mockResolvedValue([
      { name: 'own-graph', session_id: 'sess-current' },
      { name: 'other-graph', session_id: 'sess-other' },
    ])
    getFullGraphMock.mockResolvedValue({
      nodes: [
        { identity: { id: 'obj-x', type: 'Claim', name: 'Claim X' } },
        { identity: { id: 'obj-y', type: 'Claim', name: '' } },
      ],
      edges: [],
    })

    render(<CrossGraphLinkForm sessionId="sess-current" objectId="obj-a" />)

    const graphSelect = await screen.findByLabelText('Target graph')
    expect(screen.queryByText('own-graph')).not.toBeInTheDocument()
    expect(screen.getByText('other-graph')).toBeInTheDocument()

    fireEvent.change(graphSelect, { target: { value: 'other-graph' } })

    await waitFor(() => {
      expect(getFullGraphMock).toHaveBeenCalledWith('sess-other')
    })
    expect(await screen.findByText('Claim X (obj-x)')).toBeInTheDocument()
    // Falls back to id when name is empty.
    expect(screen.getByText('obj-y (obj-y)')).toBeInTheDocument()
  })

  it('submits linkGraphs with sessionIds on both sides and the chosen object/relation', async () => {
    listGraphsMock.mockResolvedValue([
      { name: 'other-graph', session_id: 'sess-other' },
    ])
    getFullGraphMock.mockResolvedValue({
      nodes: [{ identity: { id: 'obj-x', type: 'Claim', name: 'Claim X' } }],
      edges: [],
    })
    linkGraphsMock.mockResolvedValue({
      linked: true,
      relation_id: 'cross-link:a:obj-a:b:obj-x:depends_on',
      graph_a_version: 'va',
      graph_b_version: 'vb',
    })

    const onLinked = vi.fn()
    render(
      <CrossGraphLinkForm
        sessionId="sess-current"
        objectId="obj-a"
        objectLabel="Object A"
        onLinked={onLinked}
      />,
    )

    fireEvent.change(await screen.findByLabelText('Target graph'), {
      target: { value: 'other-graph' },
    })
    fireEvent.change(await screen.findByLabelText('Target object'), {
      target: { value: 'obj-x' },
    })
    fireEvent.change(screen.getByLabelText('Relation type'), {
      target: { value: 'depends_on' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create link' }))

    await waitFor(() => {
      expect(linkGraphsMock).toHaveBeenCalledWith({
        graphA: { sessionId: 'sess-current' },
        graphB: { sessionId: 'sess-other' },
        objectAId: 'obj-a',
        objectBId: 'obj-x',
        relationType: 'depends_on',
        relationName: undefined,
      })
    })

    await screen.findByText(/Linked as cross-link/)
    expect(onLinked).toHaveBeenCalled()
  })

  it('shows an inline error when link_graphs fails', async () => {
    listGraphsMock.mockResolvedValue([
      { name: 'other-graph', session_id: 'sess-other' },
    ])
    getFullGraphMock.mockResolvedValue({
      nodes: [{ identity: { id: 'obj-x', type: 'Claim', name: 'Claim X' } }],
      edges: [],
    })
    linkGraphsMock.mockRejectedValue(
      new Error("Object 'obj-a' was not found in graph A (own-graph)."),
    )

    render(<CrossGraphLinkForm sessionId="sess-current" objectId="obj-a" />)

    fireEvent.change(await screen.findByLabelText('Target graph'), {
      target: { value: 'other-graph' },
    })
    fireEvent.change(await screen.findByLabelText('Target object'), {
      target: { value: 'obj-x' },
    })
    fireEvent.change(screen.getByLabelText('Relation type'), {
      target: { value: 'depends_on' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }))

    await screen.findByText(
      "Object 'obj-a' was not found in graph A (own-graph).",
    )
  })

  it('disables Create link until a target graph, object, and relation type are chosen', async () => {
    listGraphsMock.mockResolvedValue([
      { name: 'other-graph', session_id: 'sess-other' },
    ])
    getFullGraphMock.mockResolvedValue({
      nodes: [{ identity: { id: 'obj-x', type: 'Claim', name: 'Claim X' } }],
      edges: [],
    })

    render(<CrossGraphLinkForm sessionId="sess-current" objectId="obj-a" />)

    const submit = screen.getByRole('button', { name: 'Create link' })
    expect(submit).toBeDisabled()

    fireEvent.change(await screen.findByLabelText('Target graph'), {
      target: { value: 'other-graph' },
    })
    expect(submit).toBeDisabled()

    fireEvent.change(await screen.findByLabelText('Target object'), {
      target: { value: 'obj-x' },
    })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Relation type'), {
      target: { value: 'depends_on' },
    })
    expect(submit).not.toBeDisabled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    listGraphsMock.mockResolvedValue([])
    const onCancel = vi.fn()
    render(
      <CrossGraphLinkForm
        sessionId="sess-current"
        objectId="obj-a"
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
