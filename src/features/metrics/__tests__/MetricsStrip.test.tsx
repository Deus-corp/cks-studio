// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatus, ProcessStatus } from '@/services/mcpTools'
import { MetricsStrip } from '../MetricsStrip'

const {
  listGraphsMock,
  listAgentsMock,
  listProcessesMock,
  listDeadLetteredConflictsMock,
} = vi.hoisted(() => ({
  listGraphsMock: vi.fn(),
  listAgentsMock: vi.fn(),
  listProcessesMock: vi.fn(),
  listDeadLetteredConflictsMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listGraphs: listGraphsMock,
  listAgents: listAgentsMock,
  listProcesses: listProcessesMock,
  listDeadLetteredConflicts: listDeadLetteredConflictsMock,
  getMetrics: vi.fn(),
}))

/** Flushes pending microtasks without touching fake timers -- `waitFor`
 *  polls via real setTimeout internally, which deadlocks once
 *  `vi.useFakeTimers()` is active, so we flush by hand (same pattern as
 *  useProcessesPolling.test.ts). */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function agent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    agent_id: 'contradiction_sweeper',
    kind: 'sweeper',
    running: true,
    interval_seconds: 300,
    last_run_at: new Date().toISOString(),
    last_run_duration_ms: 10,
    last_result_count: 0,
    last_error: null,
    ...overrides,
  }
}

function process_(overrides: Partial<ProcessStatus> = {}): ProcessStatus {
  return {
    instance_id: 'inst-1',
    process_kind: 'critic',
    hostname: 'host-a',
    pid: 123,
    liveness_interval_s: 30,
    started_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
    current_task_id: null,
    current_task_type: null,
    status: 'alive',
    ...overrides,
  }
}

function mockAllHappy() {
  listGraphsMock.mockResolvedValue([
    { name: 'g1', session_id: 's1' },
    { name: 'g2', session_id: 's2' },
  ])
  listAgentsMock.mockResolvedValue({
    agents: [
      agent({ running: true }),
      agent({ agent_id: 'other', running: false }),
    ],
  })
  listProcessesMock.mockResolvedValue({
    processes: [
      process_({ status: 'alive' }),
      process_({ instance_id: 'i2', status: 'stopped' }),
    ],
  })
  listDeadLetteredConflictsMock.mockResolvedValue({
    tasks: [],
    count: 3,
    supported: true,
  })
}

describe('MetricsStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    listGraphsMock.mockReset()
    listAgentsMock.mockReset()
    listProcessesMock.mockReset()
    listDeadLetteredConflictsMock.mockReset()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders metric labels and values from mocked MCP wrappers', async () => {
    mockAllHappy()

    render(<MetricsStrip />)
    await flush()

    expect(screen.getByText('Graphs')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // graphs count

    expect(screen.getByText('Agents running')).toBeInTheDocument()
    expect(screen.getByText('Processes alive')).toBeInTheDocument()
    expect(screen.getByText('Dead-letter tasks')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // dead-letter count

    // Both agentsRunning and processesAlive resolve to 1 in this fixture.
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2)
  })

  it('shows a placeholder for a metric whose fetch fails, keeping the rest', async () => {
    listGraphsMock.mockRejectedValue(new Error('graph service down'))
    listAgentsMock.mockResolvedValue({ agents: [agent({ running: true })] })
    listProcessesMock.mockResolvedValue({ processes: [process_()] })
    listDeadLetteredConflictsMock.mockResolvedValue({
      tasks: [],
      count: 0,
      supported: true,
    })

    render(<MetricsStrip />)
    await flush()

    expect(screen.getByText('—')).toBeInTheDocument()
    // Agents running (1) still renders despite the graphs failure.
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  it('shows n/a for dead-letter tasks when the backend has no outbox support', async () => {
    listGraphsMock.mockResolvedValue([])
    listAgentsMock.mockResolvedValue({ agents: [] })
    listProcessesMock.mockResolvedValue({ processes: [] })
    listDeadLetteredConflictsMock.mockResolvedValue({
      tasks: [],
      count: 0,
      supported: false,
    })

    render(<MetricsStrip />)
    await flush()

    expect(screen.getByText('n/a')).toBeInTheDocument()
  })

  it('polls again after the interval elapses', async () => {
    mockAllHappy()

    render(<MetricsStrip />)
    await flush()
    expect(listGraphsMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    await flush()

    expect(listGraphsMock).toHaveBeenCalledTimes(2)
    expect(listAgentsMock).toHaveBeenCalledTimes(2)
    expect(listProcessesMock).toHaveBeenCalledTimes(2)
    expect(listDeadLetteredConflictsMock).toHaveBeenCalledTimes(2)
  })

  it('pauses polling while the tab is hidden', async () => {
    mockAllHappy()

    render(<MetricsStrip />)
    await flush()
    expect(listGraphsMock).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(listGraphsMock).toHaveBeenCalledTimes(1)
  })
})
