// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { getFullGraph } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { STATUS_COLORS, STATUS_LABELS } from '@/shared/constants/colors'
import {
  ACTIVE_PIPELINE_STATUSES,
  type PipelineObject,
} from '@/shared/types/pipeline'
import { useEffect, useState } from 'react'
import {
  extractPipelineObjectsFromSubgraph,
  groupByStatus,
  sortTransitionLog,
} from './pipelineUtils'

/**
 * Kanban-доска Researcher -> Reviewer (ADR-007, Milestone 1).
 *
 * Данные читаются из уже существующего getFullGraph (serialize_knowledge) —
 * current_status/transition_log лежат прямо в structure каждого объекта,
 * отдельный MCP-инструмент для этого не нужен (см. cks_mcp/pipeline/schema.py).
 *
 * Важное ограничение: это snapshot, не live-стрим. Pipeline Agent (Researcher/
 * Reviewer) работает в отдельном OS-процессе и пишет прямо в общее хранилище,
 * поэтому единственный способ узнать "что изменилось" — переспросить граф.
 * Поллинг тут сознательно сделан примитивным (setInterval + ручная кнопка
 * Refresh), пока в cks-mcp нет push/subscribe API для этого.
 */
export function PipelineMonitor() {
  const { sessionId } = useSessionStore()
  const [objects, setObjects] = useState<PipelineObject[]>([])
  const [selected, setSelected] = useState<PipelineObject | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = async () => {
    if (!sessionId.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const subgraph = await getFullGraph(sessionId.trim())
      const pipelineObjects = extractPipelineObjectsFromSubgraph(subgraph)
      setObjects(pipelineObjects)
      setSelected((prev) =>
        prev ? pipelineObjects.find((o) => o.id === prev.id) || null : null,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load закрывает sessionId по значению, пересоздание при её смене — ожидаемо
  useEffect(() => {
    load()
  }, [sessionId])

  // biome-ignore lint/correctness/useExhaustiveDependencies: load закрывает sessionId по значению
  useEffect(() => {
    if (!autoRefresh || !sessionId.trim()) return
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, sessionId])

  if (!sessionId.trim()) {
    return (
      <div className="p-6 text-sm text-gray-400">
        Укажите session_id на странице Graph, чтобы увидеть pipeline-объекты.
      </div>
    )
  }

  const grouped = groupByStatus(objects)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">
          Pipeline Monitor
        </h2>
        <span className="text-xs text-gray-500">session: {sessionId}</span>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto (5s)
        </label>
      </div>

      {error && <p className="text-red-400 text-xs px-4 py-2">{error}</p>}

      {!error && objects.length === 0 && !isLoading && (
        <p className="text-xs text-gray-500 px-4 py-2">
          В этой сессии нет объектов с current_status — Researcher/Reviewer ещё
          не запускались над ней, либо это не pipeline-сессия.
        </p>
      )}

      <div className="flex-1 flex gap-3 overflow-x-auto p-4">
        {ACTIVE_PIPELINE_STATUSES.map((status) => {
          const items = grouped.get(status) ?? []
          return (
            <div
              key={status}
              className="flex-shrink-0 w-56 bg-gray-900 border border-gray-800 rounded flex flex-col"
            >
              <div
                className="px-3 py-2 text-xs font-medium border-b border-gray-800 flex items-center gap-2"
                style={{ color: STATUS_COLORS[status] }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {STATUS_LABELS[status]}
                <span className="ml-auto text-gray-500">{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map((obj) => (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => setSelected(obj)}
                    className={`w-full text-left text-xs bg-gray-800 hover:bg-gray-700 rounded px-2 py-1.5 border ${
                      selected?.id === obj.id
                        ? 'border-blue-500'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="font-medium text-gray-200 truncate">
                      {obj.name}
                    </div>
                    <div className="text-gray-500">{obj.type}</div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="border-t border-gray-800 p-4 max-h-56 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-200 mb-2">
            Transition log — {selected.name}
          </h3>
          {selected.transition_log.length === 0 ? (
            <p className="text-xs text-gray-500">Пусто.</p>
          ) : (
            <ol className="space-y-1">
              {sortTransitionLog(selected.transition_log).map((entry, idx) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: transition_log — append-only лог без своего id
                  key={idx}
                  className="text-xs text-gray-400 flex gap-2"
                >
                  <span className="text-gray-600">{entry.timestamp}</span>
                  <span className="text-gray-300">{entry.agent}</span>
                  <span>{entry.action}</span>
                  <span
                    style={{
                      color:
                        STATUS_COLORS[
                          entry.transitioned_to as keyof typeof STATUS_COLORS
                        ],
                    }}
                  >
                    → {entry.transitioned_to}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
