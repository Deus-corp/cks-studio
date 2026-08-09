// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { AgentStatus, ProcessStatus } from '@/services/mcpTools'
import { formatRelativeTime } from '@/shared/utils/formatUtils'
import { useAgentsPolling } from './useAgentsPolling'
import { useProcessesPolling } from './useProcessesPolling'

const MAX_ERROR_LENGTH = 140

function truncateError(message: string): string {
  if (message.length <= MAX_ERROR_LENGTH) return message
  return `${message.slice(0, MAX_ERROR_LENGTH)}…`
}

function AgentCard({ agent }: { agent: AgentStatus }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
            agent.running ? 'bg-green-500' : 'bg-gray-600'
          }`}
          title={agent.running ? 'running' : 'not running'}
        />
        <span className="text-sm font-medium text-gray-200 truncate">
          {agent.agent_id}
        </span>
        <span className="ml-auto text-xs text-gray-500">
          every {agent.interval_seconds}s
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
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
    </div>
  )
}

function ProcessCard({ process }: { process: ProcessStatus }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
            process.status === 'alive' ? 'bg-green-500' : 'bg-gray-600'
          }`}
          title={process.status}
        />
        <span className="text-sm font-medium text-gray-200 truncate">
          {process.process_kind}
        </span>
        <span className="ml-auto text-xs text-gray-500">
          pid {process.pid} @ {process.hostname}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span title={process.last_heartbeat_at}>
          heartbeat: {formatRelativeTime(process.last_heartbeat_at)}
        </span>
        <span title={process.started_at}>
          started: {formatRelativeTime(process.started_at)}
        </span>
      </div>

      {process.current_task_id !== null && (
        <div className="text-xs text-gray-400">
          working on task #{process.current_task_id}
          {process.current_task_type ? ` (${process.current_task_type})` : ''}
        </div>
      )}
    </div>
  )
}

/**
 * Пассивная read-only панель in-process sweeper'ов (ContradictionSweeper,
 * InferenceStalenessSweeper и т.д. — см. list_agents schema в cks-mcp).
 *
 * Намеренно без кнопок и действий (v1 из AGENT_VISIBILITY.md) — запуск/
 * остановка sweeper'ов требует отдельного дизайна конкурентного доступа
 * и персистентности состояния "остановлен вручную", это Control Panel,
 * не эта панель.
 *
 * Вторая секция (v2) показывает standalone-агентов (Critic/Enrichment/
 * Fork Resolution/Pipeline Agent) через list_processes — общую таблицу
 * cks_agent_liveness (см. cks-runtime ADR-014). Как и sweeper-секция,
 * это чисто read-only снимок, без действий.
 */
export function AgentPanel() {
  const { agents, lastFetchedAt, error, isLoading, refresh } =
    useAgentsPolling()
  const {
    processes,
    lastFetchedAt: processesLastFetchedAt,
    error: processesError,
    isLoading: processesLoading,
    refresh: refreshProcesses,
  } = useProcessesPolling()

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Agents</h2>
        <span className="text-xs text-gray-500">
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
          className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading || processesLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section>
          <p className="text-xs text-gray-500 px-4 py-2">
            In-process sweeper'ы этого MCP-сервера.
          </p>

          {error && (
            <p className="text-red-400 text-xs px-4 py-2">
              Не удалось получить статус агентов: {error}
            </p>
          )}

          {!error && agents.length === 0 && !isLoading && (
            <p className="text-xs text-gray-500 px-4 py-2">
              Нет включённых sweeper'ов — либо все отключены через конфиг
              Runtime, либо MCP-сервер только что запустился.
            </p>
          )}

          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.agent_id} agent={agent} />
            ))}
          </div>
        </section>

        <section className="border-t border-gray-800">
          <div className="flex items-center gap-3 px-4 py-2">
            <h3 className="text-xs font-semibold text-gray-300">
              Standalone-процессы
            </h3>
            <span className="text-xs text-gray-500">
              {processesLastFetchedAt
                ? `updated ${formatRelativeTime(processesLastFetchedAt.toISOString())}`
                : 'loading…'}
            </span>
          </div>

          <p className="text-xs text-gray-500 px-4 pb-2">
            Critic / Enrichment / Fork Resolution / Pipeline Agent — из общей
            таблицы cks_agent_liveness (см. cks-runtime ADR-014). В multi-node
            деплое могут быть с других узлов.
          </p>

          {processesError && (
            <p className="text-red-400 text-xs px-4 py-2">
              Не удалось получить статус процессов: {processesError}
            </p>
          )}

          {!processesError && processes.length === 0 && !processesLoading && (
            <p className="text-xs text-gray-500 px-4 py-2">
              Ни один standalone-процесс ещё не писал heartbeat.
            </p>
          )}

          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {processes.map((process) => (
              <ProcessCard key={process.instance_id} process={process} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
