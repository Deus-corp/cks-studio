// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useState } from 'react'
import type { ProcessStatus } from '@/services/mcpTools'
import {
  type AgentNotFound,
  type AgentStatus,
  requestProcessStop,
  startAgent,
  stopAgent,
} from '@/services/mcpTools'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { formatRelativeTime } from '@/shared/utils/formatUtils'
import { useAgentsPolling } from './useAgentsPolling'
import { useProcessesPolling } from './useProcessesPolling'

const MAX_ERROR_LENGTH = 140

// Dead standalone-agent processes never get deleted from the shared
// cks_agent_liveness table (see cks-runtime ADR-014) -- it's a history
// of every instance that ever started, not just the current ones. Left
// unfiltered, list_processes' rows accumulate forever and the panel
// fills up with "stopped" cards whose heartbeat is weeks/months old.
// A process that's still alive (per list_processes' own TTL-based
// status) is always shown, on any host -- ADR-014/ADR-016 explicitly
// allow multiple concurrent instances of the same kind across nodes in
// a multi-node deployment, so we must not collapse those. A stopped
// process is only worth surfacing for a little while after it exits
// (useful context: "this just died"); past that window it's noise.
const STALE_STOPPED_THRESHOLD_MS = 24 * 60 * 60 * 1000

function isStaleStoppedProcess(process: ProcessStatus): boolean {
  if (process.status === 'alive') return false
  const heartbeatMs = Date.parse(process.last_heartbeat_at)
  if (Number.isNaN(heartbeatMs)) return true
  return Date.now() - heartbeatMs > STALE_STOPPED_THRESHOLD_MS
}

/** All standalone agent kinds cks-runtime knows about (see
 *  ProcessStatus['process_kind']), used to render a placeholder card for
 *  any kind that has never sent a heartbeat -- otherwise an agent that
 *  simply hasn't been started yet is indistinguishable from one that
 *  doesn't exist. */
const KNOWN_PROCESS_KINDS: Array<{
  kind: ProcessStatus['process_kind']
  label: string
}> = [
  { kind: 'critic', label: 'Critic' },
  { kind: 'enrichment', label: 'Enrichment' },
  { kind: 'fork_resolution', label: 'Fork Resolution' },
  { kind: 'pipeline', label: 'Pipeline' },
]

function UnknownProcessCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col bg-surface-1 border border-border-subtle rounded p-3 space-y-2 h-full">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full inline-block flex-shrink-0 bg-text-tertiary"
          title="not running"
        />
        <span className="text-sm font-medium text-text-primary truncate">
          {label}
        </span>
      </div>

      <p className="text-xs text-text-tertiary">
        not running / no heartbeat yet
      </p>

      <div className="mt-auto pt-2 border-t border-border-subtle/60">
        <p className="text-[11px] text-text-tertiary italic">
          Started manually as a separate OS process — not managed from this UI.
        </p>
      </div>
    </div>
  )
}

function truncateError(message: string): string {
  if (message.length <= MAX_ERROR_LENGTH) return message
  return `${message.slice(0, MAX_ERROR_LENGTH)}…`
}

function isNotFound(
  result: AgentStatus | AgentNotFound,
): result is AgentNotFound {
  return (result as AgentNotFound).found === false
}

interface AgentCardProps {
  agent: AgentStatus
  /** true пока start_agent/stop_agent в полёте для этого agent_id. */
  isBusy: boolean
  actionError: string | null
  onStart: (agentId: string) => void
  onStop: (agentId: string) => void
}

function AgentCard({
  agent,
  isBusy,
  actionError,
  onStart,
  onStop,
}: AgentCardProps) {
  return (
    <div className="bg-surface-1 border border-border-subtle rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
            agent.running ? 'bg-green-500' : 'bg-text-tertiary'
          }`}
          title={agent.running ? 'running' : 'not running'}
        />
        <span className="text-sm font-medium text-text-primary truncate">
          {agent.agent_id}
        </span>
        <span className="ml-auto text-xs text-text-tertiary">
          every {agent.interval_seconds}s
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span title={agent.last_run_at ?? undefined}>
          last run: {formatRelativeTime(agent.last_run_at)}
        </span>
        {agent.last_run_duration_ms !== null && (
          <span>took {agent.last_run_duration_ms}ms</span>
        )}
        {agent.last_result_count !== null && (
          <span>{agent.last_result_count} result(s)</span>
        )}
      </div>

      {agent.last_error && (
        <div
          className="text-xs text-red-400 break-words"
          title={agent.last_error}
        >
          {truncateError(agent.last_error)}
        </div>
      )}

      {actionError && (
        <div className="text-xs text-red-400 break-words" title={actionError}>
          {truncateError(actionError)}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onStart(agent.agent_id)}
          disabled={isBusy || agent.running}
          className="text-xs bg-brand hover:bg-brand-strong text-brand-text px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBusy ? '…' : 'Start'}
        </button>
        <button
          type="button"
          onClick={() => onStop(agent.agent_id)}
          disabled={isBusy || !agent.running}
          className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBusy ? '…' : 'Stop'}
        </button>
      </div>
    </div>
  )
}

interface ProcessCardProps {
  process: ProcessStatus
  /** true пока request_process_stop в полёте для этого instance_id. */
  isBusy: boolean
  /** true после того, как запрос был accepted, пока status ещё не 'stopped'. */
  stopRequested: boolean
  actionError: string | null
  onRequestStop: (process: ProcessStatus) => void
}

function ProcessCard({
  process,
  isBusy,
  stopRequested,
  actionError,
  onRequestStop,
}: ProcessCardProps) {
  const isAlive = process.status === 'alive'
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
        <span title={process.last_heartbeat_at}>
          heartbeat: {formatRelativeTime(process.last_heartbeat_at)}
        </span>
        <span title={process.started_at}>
          started: {formatRelativeTime(process.started_at)}
        </span>
      </div>

      {process.current_task_id !== null && (
        <div className="text-xs text-text-secondary">
          working on task #{process.current_task_id}
          {process.current_task_type ? ` (${process.current_task_type})` : ''}
        </div>
      )}

      {stopRequested && isAlive && (
        <div className="text-xs text-yellow-400">
          stop requested — waiting for process to exit…
        </div>
      )}

      {actionError && (
        <div className="text-xs text-red-400 break-words" title={actionError}>
          {truncateError(actionError)}
        </div>
      )}

      {/* mt-auto прижимает футер карточки (кнопка + заметка) книзу, так
       *  что кнопки Request Stop выравниваются по одной линии по всей
       *  строке грида независимо от того, сколько строк занял
       *  current_task_id/actionError у соседних карточек. */}
      <div className="mt-auto space-y-1.5 pt-2 border-t border-border-subtle/60">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onRequestStop(process)}
            disabled={isBusy || !isAlive || stopRequested}
            title="No start tool exists — cks-mcp cannot spawn a new OS process (ADR-016 §4); restarting is an operational action outside this panel's scope."
            className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBusy ? '…' : stopRequested ? 'Stop requested' : 'Request Stop'}
          </button>
        </div>
        {/* Явно поясняем происхождение процесса: в отличие от Agent-карточек
         *  выше (start_agent/stop_agent из этого же UI), standalone-процессы
         *  стартуют как отдельные OS-процессы вне студии — без этой
         *  заметки было неочевидно, почему тут нет кнопки Start. */}
        <p className="text-[11px] text-text-tertiary italic">
          Started manually as a separate OS process — not managed from this UI.
        </p>
      </div>
    </div>
  )
}

/**
 * Панель in-process sweeper'ов (ContradictionSweeper,
 * InferenceStalenessSweeper и т.д. — см. list_agents schema в cks-mcp) с
 * возможностью Start/Stop на базе start_agent/stop_agent (v2, см.
 * AGENT_VISIBILITY.md — управление добавлено поверх read-only v1).
 * Действие затрагивает только ноду, к которой подключена студия
 * (см. ADR-015 §3 про намеренную асимметрию start/stop между нодами
 * в multi-node деплое — start НЕ распространяется, stop распространяется
 * в течение одного sweep-интервала).
 *
 * Вторая секция показывает standalone-агентов (Critic/Enrichment/
 * Fork Resolution/Pipeline Agent) через list_processes — общую таблицу
 * cks_agent_liveness (см. cks-runtime ADR-014), с Request Stop на базе
 * request_process_stop. Старт-тула для этих процессов не существует
 * (cks-mcp не может спавнить OS-процесс, ADR-016 §4) — только запрос
 * на graceful-остановку.
 */
export function AgentPanel() {
  const pollingIntervalMs = useSettingsStore((s) => s.pollingIntervalMs)
  const { agents, lastFetchedAt, error, isLoading, refresh } =
    useAgentsPolling(pollingIntervalMs)
  const {
    processes,
    lastFetchedAt: processesLastFetchedAt,
    error: processesError,
    isLoading: processesLoading,
    refresh: refreshProcesses,
  } = useProcessesPolling(pollingIntervalMs)

  // Отдельно от polling-состояния: какие agent_id/instance_id сейчас в
  // полёте (busy) и ошибка последнего действия для каждого — polling не
  // должен эти сбрасывать между тиками.
  const [busyAgents, setBusyAgents] = useState<Set<string>>(new Set())
  const [agentActionErrors, setAgentActionErrors] = useState<
    Record<string, string>
  >({})
  const [busyProcesses, setBusyProcesses] = useState<Set<string>>(new Set())
  const [processActionErrors, setProcessActionErrors] = useState<
    Record<string, string>
  >({})
  // instance_id -> запрос на остановку принят, ждём status: 'stopped'.
  const [stopRequestedInstances, setStopRequestedInstances] = useState<
    Set<string>
  >(new Set())

  // Убираем instance_id из stopRequestedInstances, как только его статус
  // фактически стал 'stopped' (ADR-016 §3: status флипается сразу же по
  // выходу процесса, не по медленному TTL) — иначе сет копится вечно.
  useEffect(() => {
    setStopRequestedInstances((prev) => {
      if (prev.size === 0) return prev
      const stillAlive = new Set(
        processes.filter((p) => p.status === 'alive').map((p) => p.instance_id),
      )
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (stillAlive.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [processes])

  const handleStart = useCallback(
    async (agentId: string) => {
      setBusyAgents((prev) => new Set(prev).add(agentId))
      setAgentActionErrors((prev) => {
        const next = { ...prev }
        delete next[agentId]
        return next
      })
      try {
        const result = await startAgent(agentId)
        if (isNotFound(result)) {
          setAgentActionErrors((prev) => ({
            ...prev,
            [agentId]: 'Sweeper not found — disabled via Runtime config?',
          }))
        }
      } catch (e) {
        setAgentActionErrors((prev) => ({
          ...prev,
          [agentId]: e instanceof Error ? e.message : 'Unknown error',
        }))
      } finally {
        setBusyAgents((prev) => {
          const next = new Set(prev)
          next.delete(agentId)
          return next
        })
        refresh()
      }
    },
    [refresh],
  )

  const handleStop = useCallback(
    async (agentId: string) => {
      setBusyAgents((prev) => new Set(prev).add(agentId))
      setAgentActionErrors((prev) => {
        const next = { ...prev }
        delete next[agentId]
        return next
      })
      try {
        const result = await stopAgent(agentId)
        if (isNotFound(result)) {
          setAgentActionErrors((prev) => ({
            ...prev,
            [agentId]: 'Sweeper not found — disabled via Runtime config?',
          }))
        }
      } catch (e) {
        setAgentActionErrors((prev) => ({
          ...prev,
          [agentId]: e instanceof Error ? e.message : 'Unknown error',
        }))
      } finally {
        setBusyAgents((prev) => {
          const next = new Set(prev)
          next.delete(agentId)
          return next
        })
        refresh()
      }
    },
    [refresh],
  )

  const handleRequestStop = useCallback(
    async (process: ProcessStatus) => {
      const key = process.instance_id
      setBusyProcesses((prev) => new Set(prev).add(key))
      setProcessActionErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      try {
        const result = await requestProcessStop(process.process_kind)
        if ('found' in result && result.found === false) {
          setProcessActionErrors((prev) => ({
            ...prev,
            [key]: 'Process not found — heartbeat never received?',
          }))
        } else if (!('accepted' in result) || !result.accepted) {
          setProcessActionErrors((prev) => ({
            ...prev,
            [key]: 'Stop request was not accepted.',
          }))
        } else {
          setStopRequestedInstances((prev) => new Set(prev).add(key))
        }
      } catch (e) {
        setProcessActionErrors((prev) => ({
          ...prev,
          [key]: e instanceof Error ? e.message : 'Unknown error',
        }))
      } finally {
        setBusyProcesses((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
        refreshProcesses()
      }
    },
    [refreshProcesses],
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Agents</h2>
        <span className="text-xs text-text-tertiary">
          {lastFetchedAt
            ? `updated ${formatRelativeTime(lastFetchedAt.toISOString())}`
            : 'loading…'}
        </span>
        <button
          type="button"
          onClick={() => {
            refresh()
            refreshProcesses()
          }}
          disabled={isLoading || processesLoading}
          className="ml-auto text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading || processesLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section>
          <p className="text-xs text-text-tertiary px-4 py-2">
            In-process sweepers for this MCP server.
          </p>

          {error && (
            <p className="text-red-400 text-xs px-4 py-2">
              Failed to fetch agents status: {error}
            </p>
          )}

          {!error && agents.length === 0 && !isLoading && (
            <p className="text-xs text-text-tertiary px-4 py-2">
              No enabled sweepers — either all are disabled via the Runtime
              config, or the MCP server has just started.
            </p>
          )}

          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                isBusy={busyAgents.has(agent.agent_id)}
                actionError={agentActionErrors[agent.agent_id] ?? null}
                onStart={handleStart}
                onStop={handleStop}
              />
            ))}
          </div>
        </section>

        <section className="border-t border-border-subtle">
          <div className="flex items-center gap-3 px-4 py-2">
            <h3 className="text-xs font-semibold text-text-secondary">
              Standalone Processes
            </h3>
            <span className="text-xs text-text-tertiary">
              {processesLastFetchedAt
                ? `updated ${formatRelativeTime(processesLastFetchedAt.toISOString())}`
                : 'loading…'}
            </span>
          </div>

          <p className="text-xs text-text-tertiary px-4 pb-2">
            Critic / Enrichment / Fork Resolution / Pipeline Agent — from the
            shared cks_agent_liveness table (see cks-runtime ADR-014). In a
            multi‑node deployment these may originate from other nodes.
          </p>

          {processesError && (
            <p className="text-red-400 text-xs px-4 py-2">
              Unable to fetch process status: {processesError}
            </p>
          )}

          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {processes
              .filter((p) => !isStaleStoppedProcess(p))
              .map((process) => (
                <ProcessCard
                  key={process.instance_id}
                  process={process}
                  isBusy={busyProcesses.has(process.instance_id)}
                  stopRequested={stopRequestedInstances.has(
                    process.instance_id,
                  )}
                  actionError={processActionErrors[process.instance_id] ?? null}
                  onRequestStop={handleRequestStop}
                />
              ))}
            {!processesError &&
              !processesLoading &&
              KNOWN_PROCESS_KINDS.filter(
                ({ kind }) =>
                  !processes.some(
                    (p) => p.process_kind === kind && !isStaleStoppedProcess(p),
                  ),
              ).map(({ kind, label }) => (
                <UnknownProcessCard key={kind} label={label} />
              ))}
          </div>
        </section>
      </div>
    </div>
  )
}
