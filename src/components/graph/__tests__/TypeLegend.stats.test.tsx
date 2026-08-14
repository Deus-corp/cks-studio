// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { TypeLegend } from '../TypeLegend'

beforeEach(() => {
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
      data: { label: 'B', cksType: 'Tool' },
    },
  ])
  useGraphStore.getState().setEdges([{ id: 'a-b', source: 'a', target: 'b' }])
})

afterEach(() => {
  cleanup()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().clearMultiSelect()
  useGraphStore.getState().showAllTypes()
})

describe('TypeLegend — stats toggle', () => {
  it('shows the node type list by default', () => {
    render(<TypeLegend />)

    expect(screen.getByText('Concept')).toBeInTheDocument()
    expect(screen.getByText('Tool')).toBeInTheDocument()
  })

  it('switches to graph stats when the toggle is clicked, and back on a second click', () => {
    render(<TypeLegend />)

    fireEvent.click(screen.getByRole('button', { name: /stats/i }))

    // Node count and edge count from the two nodes / one edge above.
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('Concept')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /types/i }))

    expect(screen.getByText('Concept')).toBeInTheDocument()
    expect(screen.getByText('Tool')).toBeInTheDocument()
  })
})
