// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { formatRelativeTime } from '@/shared/utils/formatUtils'

interface DemoSweeper {
  agent_id: string
  running: boolean
  interval_seconds: number
  last_run_offset_s: number
  last_run_duration_ms: number
  last_result_count: number
}

interface DemoProcess {
  instance_id: string
  process_kind: 'critic' | 'enrichment' | 'fork_resolution' | 'pipeline'
  hostname: string
  pid: number
  last_heartbeat_offset_s: number
  started_offset_s: number
  current_task_id: number | null
  current_task_type: string | null
  status: 'alive' | 'stopped'
}

// Static, plausible-looking snapshot -- mirrors the shape list_agents/
// list_processes return, but frozen at page-load time (Date.now() minus
// an offset) rather than polled, since there's no server here to poll.
const now = Date.now()
const _minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()

const SWEEPERS: DemoSweeper[] = [
  {
    agent_id: 'contradiction',
    running: true,
    interval_seconds: 120,
    last_run_offset_s: 45,
    last_run_duration_ms: 340,
    last_result_count: 0,
  },
  {
    agent_id: 'inference_staleness',
    running: true,
    interval_seconds: 300,
    last_run_offset_s: 210,
    last_run_duration_ms: 812,
    last_result_count: 2,
  },
  {
    agent_id: 'provenance_staleness',
    running: true,
    interval_seconds: 900,
    last_run_offset_s: 480,
    last_run_duration_ms: 156,
    last_result_count: 0,
  },
  {
    agent_id: 'temporal_staleness',
    running: true,
    interval_seconds: 600,
    last_run_offset_s: 90,
    last_run_duration_ms: 271,
    last_result_count: 1,
  },
  {
    agent_id: 'graph_freshness',
    running: true,
    interval_seconds: 180,
    last_run_offset_s: 30,
    last_run_duration_ms: 98,
    last_result_count: 0,
  },
  {
    agent_id: 'graph_auto_update',
    running: false,
    interval_seconds: 3600,
    last_run_offset_s: 5820,
    last_run_duration_ms: 4103,
    last_result_count: 3,
  },
  {
    agent_id: 'graph_health',
    running: true,
    interval_seconds: 3600,
    last_run_offset_s: 1440,
    last_run_duration_ms: 2210,
    last_result_count: 1,
  },
]

const PROCESSES: DemoProcess[] = [
  {
    instance_id: 'critic-8f21',
    process_kind: 'critic',
    hostname: 'cks-node-1',
    pid: 41821,
    last_heartbeat_offset_s: 8,
    started_offset_s: 86400,
    current_task_id: 5821,
    current_task_type: 'contradiction_review',
    status: 'alive',
  },
  {
    instance_id: 'enrichment-3ac0',
    process_kind: 'enrichment',
    hostname: 'cks-node-1',
    pid: 41902,
    last_heartbeat_offset_s: 14,
    started_offset_s: 86400,
    current_task_id: null,
    current_task_type: null,
    status: 'alive',
  },
  {
    instance_id: 'fork-resolution-11d4',
    process_kind: 'fork_resolution',
    hostname: 'cks-node-2',
    pid: 9931,
    last_heartbeat_offset_s: 22,
    started_offset_s: 172800,
    current_task_id: 118,
    current_task_type: 'merge_conflict',
    status: 'alive',
  },
  {
    instance_id: 'pipeline-6e02',
    process_kind: 'pipeline',
    hostname: 'cks-node-1',
    pid: 41955,
    last_heartbeat_offset_s: 3600,
    started_offset_s: 604800,
    current_task_id: null,
    current_task_type: null,
    status: 'stopped',
  },
]

function offsetToIso(seconds: number): string {
  return new Date(now - seconds * 1000).toISOString()
}

function SweeperCard({ sweeper }: { sweeper: DemoSweeper }) {
  const lastRunIso = offsetToIso(sweeper.last_run_offset_s)
  return (
    <div className="bg-surface-1 border border-border-subtle rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
            sweeper.running ? 'bg-green-500' : 'bg-text-tertiary'
          }`}
          title={sweeper.running ? 'running' : 'not running'}
        />
        <span className="text-sm font-medium text-text-primary truncate">
          {sweeper.agent_id}
        </span>
        <span className="ml-auto text-xs text-text-tertiary">
          every {sweeper.interval_seconds}s
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span title={lastRunIso}>
          last run: {formatRelativeTime(lastRunIso)}
        </span>
        <span>took {sweeper.last_run_duration_ms}ms</span>
        <span>{sweeper.last_result_count} result(s)</span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled
          title="Demo only — no live server to start/stop"
          className="text-xs bg-brand text-brand-text px-2 py-1 rounded opacity-40 cursor-not-allowed"
        >
          Start
        </button>
        <button
          type="button"
          disabled
          title="Demo only — no live server to start/stop"
          className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded opacity-40 cursor-not-allowed"
        >
          Stop
        </button>
      </div>
    </div>
  )
}

function ProcessCard({ process }: { process: DemoProcess }) {
  const isAlive = process.status === 'alive'
  const heartbeatIso = offsetToIso(process.last_heartbeat_offset_s)
  const startedIso = offsetToIso(process.started_offset_s)
  return (
    <div className="flex flex-col bg-surface-1 border border-border-subtle rounded p-3 space-y-2 h-full">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
            isAlive ? 'bg-green-500' : 'bg-text-tertiary'
          }`}
          title={process.status}
        />
        <span className="text-sm font-medium text-text-primary truncate">
          {process.process_kind}
        </span>
        <span className="ml-auto text-xs text-text-tertiary">
          pid {process.pid} @ {process.hostname}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span title={heartbeatIso}>
          heartbeat: {formatRelativeTime(heartbeatIso)}
        </span>
        <span title={startedIso}>
          started: {formatRelativeTime(startedIso)}
        </span>
      </div>

      {process.current_task_id !== null && (
        <div className="text-xs text-text-secondary">
          working on task #{process.current_task_id}
          {process.current_task_type ? ` (${process.current_task_type})` : ''}
        </div>
      )}

      <div className="mt-auto space-y-1.5 pt-2 border-t border-border-subtle/60">
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            title="Demo only — no live server to request a stop"
            className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded opacity-40 cursor-not-allowed"
          >
            Request Stop
          </button>
        </div>
        <p className="text-[11px] text-text-tertiary italic">
          Started manually as a separate OS process — not managed from this UI.
        </p>
      </div>
    </div>
  )
}

/**
 * Static stand-in for AgentPanel: same layout (in-process sweepers, then
 * standalone processes) with a frozen mock snapshot instead of
 * list_agents/list_processes polling, since there's no cks-mcp server
 * behind this demo to poll. Start/Stop/Request Stop are visible but
 * disabled -- they read as real controls, not just a static list, without
 * pretending they'd do anything here.
 */
export function DemoAgentsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Agents</h2>
        <span className="text-xs text-text-tertiary">
          Static demo snapshot — not live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section>
          <p className="text-xs text-text-tertiary px-4 py-2">
            In-process sweepers for this MCP server.
          </p>

          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SWEEPERS.map((sweeper) => (
              <SweeperCard key={sweeper.agent_id} sweeper={sweeper} />
            ))}
          </div>
        </section>

        <section className="border-t border-border-subtle">
          <div className="flex items-center gap-3 px-4 py-2">
            <h3 className="text-xs font-semibold text-text-secondary">
              Standalone Processes
            </h3>
          </div>

          <p className="text-xs text-text-tertiary px-4 pb-2">
            Critic / Enrichment / Fork Resolution / Pipeline Agent — from the
            shared cks_agent_liveness table (see cks-runtime ADR-014). In a
            multi-node deployment these may originate from other nodes.
          </p>

          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {PROCESSES.map((process) => (
              <ProcessCard key={process.instance_id} process={process} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
