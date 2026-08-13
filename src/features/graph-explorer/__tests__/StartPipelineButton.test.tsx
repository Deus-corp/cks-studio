// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '../graphExplorerStore'
import { StartPipelineButton } from '../StartPipelineButton'

const { startPipelineMock } = vi.hoisted(() => ({
  startPipelineMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  startPipeline: startPipelineMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useGraphStore.getState().clearMultiSelect()
})

describe('StartPipelineButton', () => {
  it('is disabled when no nodes are selected', () => {
    render(<StartPipelineButton sessionId="sess-1" />)

    expect(
      screen.getByRole('button', { name: /start pipeline/i }),
    ).toBeDisabled()
  })

  it('is enabled once nodes are selected, and shows the selection count', () => {
    useGraphStore.getState().setMultiSelect(['node-a', 'node-b'])

    render(<StartPipelineButton sessionId="sess-1" />)

    const button = screen.getByRole('button', { name: /start pipeline \(2\)/i })
    expect(button).toBeEnabled()
  })

  it('calls startPipeline with the session id and selected object ids', async () => {
    useGraphStore.getState().setMultiSelect(['node-a', 'node-b'])
    startPipelineMock.mockResolvedValue({ run_id: 'run-42', status: 'queued' })

    render(<StartPipelineButton sessionId="sess-1" />)

    fireEvent.click(
      screen.getByRole('button', { name: /start pipeline \(2\)/i }),
    )

    await waitFor(() =>
      expect(startPipelineMock).toHaveBeenCalledWith('sess-1', [
        'node-a',
        'node-b',
      ]),
    )
    expect(
      await screen.findByText(/Pipeline started with 2 objects/),
    ).toBeInTheDocument()
  })

  it('shows an error message when startPipeline fails', async () => {
    useGraphStore.getState().setMultiSelect(['node-a'])
    startPipelineMock.mockRejectedValue(new Error('mcp unavailable'))

    render(<StartPipelineButton sessionId="sess-1" />)

    fireEvent.click(
      screen.getByRole('button', { name: /start pipeline \(1\)/i }),
    )

    expect(await screen.findByText('mcp unavailable')).toBeInTheDocument()
  })
})
