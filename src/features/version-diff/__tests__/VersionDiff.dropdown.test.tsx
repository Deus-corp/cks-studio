// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/services/sessionStore'
import { VersionDiff } from '../VersionDiff'

const { listVersionsMock, explainDiffMock } = vi.hoisted(() => ({
  listVersionsMock: vi.fn(),
  explainDiffMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listVersions: listVersionsMock,
  explainDiff: explainDiffMock,
}))

function makeVersions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    version_id: `v${String(i).padStart(3, '0')}-abcdef`,
    created_at: new Date(2026, 0, i + 1).toISOString(),
  }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('VersionDiff target-version dropdown', () => {
  it('renders a scrollable, fixed-position listbox for a long version list', async () => {
    useSessionStore.setState({ sessionId: 'sess-1' })
    listVersionsMock.mockResolvedValue({ versions: makeVersions(30) })
    explainDiffMock.mockResolvedValue({ details: {} })

    render(<VersionDiff />)

    const trigger = await screen.findByRole('button', { name: /v0\d+/i })
    fireEvent.click(trigger)

    const listbox = await screen.findByRole('listbox')
    // The list container itself must be the thing that scrolls
    // internally (max-height + overflow-y auto) -- not the individual
    // options moving the whole page/list around.
    expect(listbox.className).toMatch(/overflow-y-auto/)
    expect(listbox.className).toMatch(/max-h-/)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(30)
  })
})
