// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  DeadLetterTask,
  ReviewDeadLetterResult,
} from '@/services/mcpTools'
import { DeadLetterPanel } from '../DeadLetterPanel'

const {
  listDeadLetteredConflictsMock,
  reviewDeadLetterMock,
  approveResolutionMock,
  rejectResolutionMock,
} = vi.hoisted(() => ({
  listDeadLetteredConflictsMock: vi.fn(),
  reviewDeadLetterMock: vi.fn(),
  approveResolutionMock: vi.fn(),
  rejectResolutionMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listDeadLetteredConflicts: listDeadLetteredConflictsMock,
  reviewDeadLetter: reviewDeadLetterMock,
  approveResolution: approveResolutionMock,
  rejectResolution: rejectResolutionMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function task(overrides: Partial<DeadLetterTask> = {}): DeadLetterTask {
  return {
    task_id: 1,
    task_type: 'gossip_conflict',
    session_id: 'sess-1',
    payload: { winner_id: 'a', loser_id: 'b' },
    retry_count: 2,
    ...overrides,
  }
}

function reviewResult(
  overrides: Partial<ReviewDeadLetterResult> = {},
): ReviewDeadLetterResult {
  return {
    task_id: 1,
    task_type: 'gossip_conflict',
    session_id: 'sess-1',
    payload: { winner_id: 'a', loser_id: 'b' },
    retry_count: 2,
    last_error: 'peer unreachable',
    proposed_resolution: {
      tool: 'resolve_gossip_conflict',
      arguments: { task_id: 1, winner_id: 'a' },
    },
    ...overrides,
  }
}

describe('DeadLetterPanel', () => {
  it('renders the list of dead-lettered tasks', async () => {
    listDeadLetteredConflictsMock.mockResolvedValue({
      tasks: [
        task({ task_id: 1, task_type: 'gossip_conflict' }),
        task({
          task_id: 2,
          task_type: 'inference_conflict',
          session_id: 'sess-2',
        }),
      ],
      count: 2,
      supported: true,
    })

    render(<DeadLetterPanel />)

    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('gossip_conflict')).toBeInTheDocument()
    expect(screen.getByText('inference_conflict')).toBeInTheDocument()
  })

  it('loads and shows task details via reviewDeadLetter on selection', async () => {
    listDeadLetteredConflictsMock.mockResolvedValue({
      tasks: [task()],
      count: 1,
      supported: true,
    })
    reviewDeadLetterMock.mockResolvedValue(reviewResult())

    render(<DeadLetterPanel />)

    const row = await screen.findByText('#1')
    fireEvent.click(row)

    await waitFor(() => expect(reviewDeadLetterMock).toHaveBeenCalledWith(1))
    expect(await screen.findByText('peer unreachable')).toBeInTheDocument()
    expect(screen.getByText(/resolve_gossip_conflict/)).toBeInTheDocument()
  })

  it('approve calls approveResolution with the proposed resolution and refreshes', async () => {
    listDeadLetteredConflictsMock.mockResolvedValue({
      tasks: [task()],
      count: 1,
      supported: true,
    })
    reviewDeadLetterMock.mockResolvedValue(reviewResult())
    approveResolutionMock.mockResolvedValue({ approved: true, task_id: 1 })

    render(<DeadLetterPanel />)

    fireEvent.click(await screen.findByText('#1'))
    await screen.findByText(/resolve_gossip_conflict/)

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() =>
      expect(approveResolutionMock).toHaveBeenCalledWith(1, {
        tool: 'resolve_gossip_conflict',
        arguments: { task_id: 1, winner_id: 'a' },
      }),
    )
    // refresh() re-polls the list after a successful resolution
    await waitFor(() =>
      expect(listDeadLetteredConflictsMock).toHaveBeenCalledTimes(2),
    )
  })

  it('reject prompts for a reason and calls rejectResolution', async () => {
    listDeadLetteredConflictsMock.mockResolvedValue({
      tasks: [task()],
      count: 1,
      supported: true,
    })
    reviewDeadLetterMock.mockResolvedValue(reviewResult())
    rejectResolutionMock.mockResolvedValue({ rejected: true, task_id: 1 })

    render(<DeadLetterPanel />)

    fireEvent.click(await screen.findByText('#1'))
    await screen.findByText(/resolve_gossip_conflict/)

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.change(screen.getByPlaceholderText('Reason (optional)'), {
      target: { value: 'stale winner' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }))

    await waitFor(() =>
      expect(rejectResolutionMock).toHaveBeenCalledWith(1, 'stale winner'),
    )
    await waitFor(() =>
      expect(listDeadLetteredConflictsMock).toHaveBeenCalledTimes(2),
    )
  })
})
