// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLLMStatus, type LLMStatus } from '@/services/mcpTools'

interface UseLLMStatusResult {
  status: LLMStatus | null
  isLoading: boolean
  /** Сетевая/протокольная ошибка последнего запроса — отдельно от
   *  status.provider === 'none' (провайдер опрошен успешно, просто не
   *  настроен) и от "ещё не загружено" (status === null). */
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Опрашивает get_llm_status один раз при монтировании — без поллинга, в
 * отличие от useAgentsPolling: конфигурация провайдера меняется только
 * когда кто-то правит env/.env сервера и рестартует его, а не сама по
 * себе в рантайме. SettingsPage даёт кнопку "Refresh" на этот случай;
 * ChatPanel использует тот же хук для баннера, чтобы не делать второй
 * независимый запрос при каждом открытии чата.
 */
export function useLLMStatus(): UseLLMStatusResult {
  const [status, setStatus] = useState<LLMStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Защита от гонки, та же конвенция, что и в useAgentsPolling: ответ на
  // более ранний запрос не должен затереть более свежий результат.
  const requestSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    setIsLoading(true)
    try {
      const fetched = await getLLMStatus()
      if (seq !== requestSeq.current) return
      setStatus(fetched)
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
  }, [refresh])

  return { status, isLoading, error, refresh }
}
