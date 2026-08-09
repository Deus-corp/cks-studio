// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { type AgentStatus, listAgents } from '@/services/mcpTools'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_INTERVAL_MS = 10_000

interface UseAgentsPollingResult {
  agents: AgentStatus[]
  lastFetchedAt: Date | null
  /** Сетевая/протокольная ошибка последнего запроса — отдельно от пустого
   *  списка (нет sweeper'ов) и от "ещё не загружено" (agents === []). */
  error: string | null
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Опрашивает list_agents раз в intervalMs. Sweeper'ы сами крутятся раз в
 * 300–3600с (см. list_agents schema), поэтому 10с по умолчанию — с запасом
 * чаще, чтобы UI не выглядел замороженным после запуска студии, но не
 * настолько часто, чтобы впустую бомбить MCP-сервер.
 *
 * Поллинг ставится на паузу, когда вкладка не в фокусе
 * (document.visibilityState !== 'visible') — иначе будет вечно жужжать в
 * фоне без какой-либо пользы, т.к. смотреть всё равно некому.
 */
export function useAgentsPolling(
  intervalMs = DEFAULT_INTERVAL_MS,
): UseAgentsPollingResult {
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Защита от гонки: если запрос A стартовал раньше запроса B, но пришёл
  // позже, ответ A не должен затереть более свежий результат B.
  const requestSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    setIsLoading(true)
    try {
      const { agents: fetched } = await listAgents()
      if (seq !== requestSeq.current) return
      setAgents(fetched)
      setLastFetchedAt(new Date())
      setError(null)
    } catch (e) {
      if (seq !== requestSeq.current) return
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (seq === requestSeq.current) setIsLoading(false)
    }
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
        // Догоняем сразу, не дожидаясь следующего тика — пользователь
        // вернулся, старые данные могли протухнуть.
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

  return { agents, lastFetchedAt, error, isLoading, refresh }
}
