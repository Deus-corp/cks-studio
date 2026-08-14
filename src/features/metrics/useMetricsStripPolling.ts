// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type AgentStatus,
  listAgents,
  listDeadLetteredConflicts,
  listGraphs,
  listProcesses,
  type ProcessStatus,
} from '@/services/mcpTools'

const DEFAULT_INTERVAL_MS = 10_000

export interface MetricsStripData {
  /** null пока list_graphs ещё не ответил успешно хотя бы раз, или его
   *  последний вызов упал -- отличаем от "0 графов зарегистрировано". */
  graphsCount: number | null
  agentsRunningCount: number | null
  processesAliveCount: number | null
  deadLetterCount: number | null
  /** true, когда list_dead_lettered_conflicts ответил, но backend не
   *  поддерживает outbox (supported: false, см. mcpTools.ts) -- тогда
   *  count искусственно 0, и это стоит показать иначе, чем "0 задач". */
  deadLetterUnsupported: boolean
}

interface UseMetricsStripPollingResult {
  data: MetricsStripData
  lastFetchedAt: Date | null
  isLoading: boolean
  /** Каждый источник опрашивается независимо -- частичный сбой (например
   *  list_graphs недоступен) не должен прятать остальные метрики, поэтому
   *  ошибка хранится per-metric, а не одной строкой на весь стрип. */
  errors: {
    graphs: string | null
    agents: string | null
    processes: string | null
    deadLetter: string | null
  }
  refresh: () => Promise<void>
}

const EMPTY_DATA: MetricsStripData = {
  graphsCount: null,
  agentsRunningCount: null,
  processesAliveCount: null,
  deadLetterCount: null,
  deadLetterUnsupported: false,
}

/**
 * Опрашивает list_graphs / list_agents / list_processes /
 * list_dead_lettered_conflicts раз в intervalMs и сворачивает их в
 * компактный набор счётчиков для MetricsStrip. get_metrics() намеренно не
 * входит сюда -- get_metrics().runtime_metrics/tool_telemetry не содержит
 * счётчика pipeline/outbox задач (см. cks-mcp get_metrics/handler.py), а
 * остальные его поля (tool_telemetry, llm_telemetry) не входят в
 * минимальный набор метрик стрипа.
 *
 * Каждый источник запрашивается и обрабатывается независимо через
 * Promise.allSettled: сбой одного (например MCP-сервер без outbox
 * бэкенда для dead-letter) не должен обнулять остальные три метрики.
 *
 * Поллинг ставится на паузу при скрытой вкладке -- та же логика, что в
 * useAgentsPolling/useProcessesPolling (см. agent-panel).
 */
export function useMetricsStripPolling(
  intervalMs = DEFAULT_INTERVAL_MS,
): UseMetricsStripPollingResult {
  const [data, setData] = useState<MetricsStripData>(EMPTY_DATA)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<UseMetricsStripPollingResult['errors']>({
    graphs: null,
    agents: null,
    processes: null,
    deadLetter: null,
  })

  // Защита от гонки, как в useAgentsPolling: ответ на устаревший запрос
  // не должен затирать более свежие данные.
  const requestSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    setIsLoading(true)

    const [graphsResult, agentsResult, processesResult, deadLetterResult] =
      await Promise.allSettled([
        listGraphs(),
        listAgents(),
        listProcesses(),
        listDeadLetteredConflicts(),
      ])

    if (seq !== requestSeq.current) return

    setData((prev) => {
      const next: MetricsStripData = { ...prev }

      if (graphsResult.status === 'fulfilled') {
        next.graphsCount = graphsResult.value.length
      }
      if (agentsResult.status === 'fulfilled') {
        next.agentsRunningCount = agentsResult.value.agents.filter(
          (a: AgentStatus) => a.running,
        ).length
      }
      if (processesResult.status === 'fulfilled') {
        next.processesAliveCount = processesResult.value.processes.filter(
          (p: ProcessStatus) => p.status === 'alive',
        ).length
      }
      if (deadLetterResult.status === 'fulfilled') {
        next.deadLetterCount = deadLetterResult.value.count
        next.deadLetterUnsupported = !deadLetterResult.value.supported
      }

      return next
    })

    setErrors({
      graphs:
        graphsResult.status === 'rejected'
          ? errorMessage(graphsResult.reason)
          : null,
      agents:
        agentsResult.status === 'rejected'
          ? errorMessage(agentsResult.reason)
          : null,
      processes:
        processesResult.status === 'rejected'
          ? errorMessage(processesResult.reason)
          : null,
      deadLetter:
        deadLetterResult.status === 'rejected'
          ? errorMessage(deadLetterResult.reason)
          : null,
    })

    setLastFetchedAt(new Date())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refresh()

    let timer: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (timer !== null) return
      timer = setInterval(refresh, intervalMs)
    }
    const stopPolling = () => {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (document.visibilityState === 'visible') startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh, intervalMs])

  return { data, lastFetchedAt, isLoading, errors, refresh }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Unknown error'
}
