// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useRef, useState } from 'react'
import { type LLMModel, listLLMModels } from '@/services/mcpTools'

interface UseLLMModelsResult {
  models: LLMModel[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Опрашивает list_llm_models один раз при монтировании (та же конвенция,
 * что и useLLMStatus: без поллинга — список моделей меняется только когда
 * кто-то переустанавливает Ollama-модели или рестартует сервер с другим
 * провайдером). ChatPanel вызывает refresh() повторно при смене
 * status.provider из useLLMStatus, чтобы список моделей не отставал от
 * актуального провайдера.
 */
export function useLLMModels(): UseLLMModelsResult {
  const [models, setModels] = useState<LLMModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Защита от гонки, та же конвенция, что и в useLLMStatus/useAgentsPolling.
  const requestSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    setIsLoading(true)
    try {
      const fetched = await listLLMModels()
      if (seq !== requestSeq.current) return
      setModels(fetched)
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

  return { models, isLoading, error, refresh }
}
