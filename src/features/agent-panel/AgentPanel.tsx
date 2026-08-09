// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { AgentStatus } from '@/services/mcpTools'
import { formatRelativeTime } from '@/shared/utils/formatUtils'
import { useAgentsPolling } from './useAgentsPolling'

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

/**
 * Пассивная read-only панель in-process sweeper'ов (ContradictionSweeper,
 * InferenceStalenessSweeper и т.д. — см. list_agents schema в cks-mcp).
 *
 * Намеренно без кнопок и действий (v1 из AGENT_VISIBILITY.md) — запуск/
 * остановка sweeper'ов требует отдельного дизайна конкурентного доступа
 * и персистентности состояния "остановлен вручную", это Control Panel,
 * не эта панель.
 *
 * Не показывает standalone-агентов (Critic/Enrichment/Fork Resolution/
 * Pipeline Agent) — они работают в отдельных OS-процессах и сейчас не
 * наблюдаемы ни через один MCP-тул (см. v2 в AGENT_VISIBILITY.md).
 */
export function AgentPanel() {
  const { agents, lastFetchedAt, error, isLoading, refresh } =
    useAgentsPolling()

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
          onClick={refresh}
          disabled={isLoading}
          className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <p className="text-xs text-gray-500 px-4 py-2">
        Только in-process sweeper'ы этого MCP-сервера. Standalone-агенты
        (Critic, Enrichment, Fork Resolution, Pipeline) пока не наблюдаемы — см.
        план v2.
      </p>

      {error && (
        <p className="text-red-400 text-xs px-4 py-2">
          Не удалось получить статус агентов: {error}
        </p>
      )}

      {!error && agents.length === 0 && !isLoading && (
        <p className="text-xs text-gray-500 px-4 py-2">
          Нет включённых sweeper'ов — либо все отключены через конфиг Runtime,
          либо MCP-сервер только что запустился.
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.agent_id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
