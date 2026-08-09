// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { type ProcessStatus, listProcesses } from '@/services/mcpTools'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_INTERVAL_MS = 10_000

interface UseProcessesPollingResult {
  processes: ProcessStatus[]
  lastFetchedAt: Date | null
  /** Сетевая/протокольная ошибка последнего запроса — отдельно от
   *  пустого списка (ни один процесс ни разу не писал heartbeat) и от
   *  "ещё не загружено" (processes === []). */
  error: string | null
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Опрашивает list_processes раз в intervalMs — тот же паттерн, что и
 * useAgentsPolling (см. там подробный комментарий про выбор интервала и
 * паузу вне фокуса вкладки). heartbeat-интервал у standalone-агентов
 * per-process и может отличаться от sweeper'ных 300–3600с, но 10с
 * достаточно для отзывчивого UI без лишней нагрузки на MCP-сервер.
 */
export function useProcessesPolling(
  intervalMs = DEFAULT_INTERVAL_MS,
): UseProcessesPollingResult {
  const [processes, setProcesses] = useState<ProcessStatus[]>([])
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
      const { processes: fetched } = await listProcesses()
      if (seq !== requestSeq.current) return
      setProcesses(fetched)
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

  return { processes, lastFetchedAt, error, isLoading, refresh }
}
