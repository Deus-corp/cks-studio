// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/services/sessionStore'
import { RunHistoryPanel } from '../RunHistoryPanel'
import type { PipelineRun } from '../types'

const { loadPipelineRunsMock } = vi.hoisted(() => ({
  loadPipelineRunsMock: vi.fn(),
}))

vi.mock('../mockRuns', () => ({
  loadPipelineRuns: loadPipelineRunsMock,
  IS_MOCK_DATA: true,
}))

function run(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    runId: 'run-7f2a9c1e-0001',
    sessionId: 'sess-1',
    status: 'running',
    startedAt: '2026-08-10T09:12:00Z',
    updatedAt: '2026-08-10T09:18:42Z',
    objectIds: ['obj-1', 'obj-2'],
    steps: [
      {
        name: 'Researcher',
        status: 'completed',
        startedAt: '2026-08-10T09:12:00Z',
        completedAt: '2026-08-10T09:14:00Z',
      },
      {
        name: 'Synthesizer',
        status: 'failed',
        startedAt: '2026-08-10T09:14:00Z',
        completedAt: '2026-08-10T09:16:00Z',
        error: 'LLM provider timeout',
        deadLetterTaskId: 7,
      },
      {
        name: 'Reviewer',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        name: 'Arbiter',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  useSessionStore.setState({ sessionId: 'sess-1' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RunHistoryPanel', () => {
  it('renders the list of runs with the mock-data badge', async () => {
    loadPipelineRunsMock.mockResolvedValue([run()])

    render(<RunHistoryPanel />)

    expect(await screen.findByText('7f2a9c1e…0001')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('2 objects')).toBeInTheDocument()
    expect(screen.getByText('1/4 steps')).toBeInTheDocument()
    expect(
      screen.getByText('Demo/mock — backend connection needed'),
    ).toBeInTheDocument()
  })

  it('expanding a run shows per-step details including an error', async () => {
    loadPipelineRunsMock.mockResolvedValue([run()])

    render(<RunHistoryPanel />)

    const row = await screen.findByText('7f2a9c1e…0001')
    fireEvent.click(row)

    expect(await screen.findByText('Researcher')).toBeInTheDocument()
    expect(screen.getByText('Synthesizer')).toBeInTheDocument()
    expect(screen.getByText('Reviewer')).toBeInTheDocument()
    expect(screen.getByText('Arbiter')).toBeInTheDocument()
    expect(screen.getByText(/LLM provider timeout/)).toBeInTheDocument()
    expect(screen.getByText(/dead-letter task #7/)).toBeInTheDocument()

    // Clicking again collapses it.
    fireEvent.click(row)
    expect(screen.queryByText(/LLM provider timeout/)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no runs', async () => {
    loadPipelineRunsMock.mockResolvedValue([])

    render(<RunHistoryPanel />)

    expect(await screen.findByText(/No pipeline runs yet/)).toBeInTheDocument()
  })

  it('shows an error state when loading fails', async () => {
    loadPipelineRunsMock.mockRejectedValue(new Error('network down'))

    render(<RunHistoryPanel />)

    expect(await screen.findByText('network down')).toBeInTheDocument()
  })
})
