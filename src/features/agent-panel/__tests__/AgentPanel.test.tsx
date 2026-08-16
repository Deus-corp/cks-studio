// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatus, ProcessStatus } from '@/services/mcpTools'
import { AgentPanel } from '../AgentPanel'

const { useAgentsPollingMock, useProcessesPollingMock } = vi.hoisted(() => ({
  useAgentsPollingMock: vi.fn(),
  useProcessesPollingMock: vi.fn(),
}))

vi.mock('../useAgentsPolling', () => ({
  useAgentsPolling: useAgentsPollingMock,
}))
vi.mock('../useProcessesPolling', () => ({
  useProcessesPolling: useProcessesPollingMock,
}))

function agentsState(
  overrides: Partial<ReturnType<typeof defaultAgentsState>> = {},
) {
  return { ...defaultAgentsState(), ...overrides }
}
function defaultAgentsState() {
  return {
    agents: [] as AgentStatus[],
    lastFetchedAt: null as Date | null,
    error: null as string | null,
    isLoading: false,
    refresh: vi.fn(),
  }
}

function processesState(
  overrides: Partial<ReturnType<typeof defaultProcessesState>> = {},
) {
  return { ...defaultProcessesState(), ...overrides }
}
function defaultProcessesState() {
  return {
    processes: [] as ProcessStatus[],
    lastFetchedAt: null as Date | null,
    error: null as string | null,
    isLoading: false,
    refresh: vi.fn(),
  }
}

function makeAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    agent_id: 'contradiction_sweeper',
    kind: 'sweeper',
    running: true,
    interval_seconds: 300,
    last_run_at: new Date().toISOString(),
    last_run_duration_ms: 42,
    last_result_count: 3,
    last_error: null,
    ...overrides,
  }
}

function makeProcess(overrides: Partial<ProcessStatus> = {}): ProcessStatus {
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

describe('AgentPanel', () => {
  beforeEach(() => {
    useAgentsPollingMock.mockReset()
    useProcessesPollingMock.mockReset()
    useAgentsPollingMock.mockReturnValue(agentsState())
    useProcessesPollingMock.mockReturnValue(processesState())
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the sweeper empty-state message when there are no agents', () => {
    render(<AgentPanel />)

    expect(screen.getByText(/No enabled sweepers/)).toBeInTheDocument()
  })

  it('renders a sweeper card for each agent', () => {
    useAgentsPollingMock.mockReturnValue(
      agentsState({ agents: [makeAgent({ agent_id: 'graph_health' })] }),
    )

    render(<AgentPanel />)

    expect(screen.getByText('graph_health')).toBeInTheDocument()
    expect(screen.getByText('3 result(s)')).toBeInTheDocument()
  })

  it('shows a truncated/full sweeper error message', () => {
    useAgentsPollingMock.mockReturnValue(
      agentsState({ error: 'connection refused' }),
    )

    render(<AgentPanel />)

    expect(
      screen.getByText(/Failed to fetch agents status: connection refused/),
    ).toBeInTheDocument()
  })

  it('shows placeholder cards for all known standalone agents when none have reported', () => {
    render(<AgentPanel />)

    expect(screen.getByText('Critic')).toBeInTheDocument()
    expect(screen.getByText('Enrichment')).toBeInTheDocument()
    expect(screen.getByText('Fork Resolution')).toBeInTheDocument()
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
  })

  it('renders a process card for each standalone process, including task info', () => {
    useProcessesPollingMock.mockReturnValue(
      processesState({
        processes: [
          makeProcess({
            process_kind: 'enrichment',
            current_task_id: 7,
            current_task_type: 'enrichment_request',
          }),
        ],
      }),
    )

    render(<AgentPanel />)

    expect(screen.getByText('enrichment')).toBeInTheDocument()
    expect(
      screen.getByText(/working on task #7 \(enrichment_request\)/),
    ).toBeInTheDocument()
  })

  it('renders a stopped process with the muted status indicator', () => {
    useProcessesPollingMock.mockReturnValue(
      processesState({
        processes: [
          makeProcess({ process_kind: 'pipeline', status: 'stopped' }),
        ],
      }),
    )

    render(<AgentPanel />)

    const dot = screen.getByTitle('stopped')
    expect(dot).toHaveClass('bg-text-tertiary')
  })

  it('shows the process-section error independently of the sweeper section', () => {
    useProcessesPollingMock.mockReturnValue(
      processesState({ error: 'network down' }),
    )

    render(<AgentPanel />)

    expect(
      screen.getByText(/Unable to fetch process status: network down/),
    ).toBeInTheDocument()
    // Sweeper section is unaffected -- still shows its own empty state.
    expect(screen.getByText(/No enabled sweepers/)).toBeInTheDocument()
  })

  it('refresh button triggers both polling refreshers', () => {
    const refreshAgents = vi.fn()
    const refreshProcesses = vi.fn()
    useAgentsPollingMock.mockReturnValue(
      agentsState({ refresh: refreshAgents }),
    )
    useProcessesPollingMock.mockReturnValue(
      processesState({ refresh: refreshProcesses }),
    )

    render(<AgentPanel />)
    screen.getByRole('button', { name: /refresh/i }).click()

    expect(refreshAgents).toHaveBeenCalledTimes(1)
    expect(refreshProcesses).toHaveBeenCalledTimes(1)
  })

  it('disables the refresh button while either section is loading', () => {
    useProcessesPollingMock.mockReturnValue(processesState({ isLoading: true }))

    render(<AgentPanel />)

    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled()
  })
})
