// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useRef, useState } from 'react'
import { explainKnowledge } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type { ExplainInferenceResult } from '@/shared/types/graph'

interface UseExplainInferenceResult {
  data: ExplainInferenceResult | null
  isLoading: boolean
  error: string | null
  /** Fetch/re-fetch the explanation for `objectId`. No-ops (and clears
   *  any previous result) when there's no session or no objectId --
   *  callers gate this behind panel-open + selectedNodeId already, this
   *  is just a safety net. */
  refresh: (objectId: string | null) => Promise<void>
}

/**
 * Fetches "why is this object believed?" via explain_knowledge's
 * object_id mode (see mcpTools.explainKnowledge / ADR-001). Not
 * auto-triggered on mount or objectId change -- WhyThisBeliefPanel calls
 * refresh() itself from an effect gated on isOpen, so a closed panel
 * never fires a request for a node the user hasn't asked to inspect.
 *
 * Same request-sequence guard as useLLMStatus: refresh() can be called
 * again (a new node selected) before an in-flight request resolves, and
 * the stale response must not clobber the newer one.
 */
export function useExplainInference(): UseExplainInferenceResult {
  const sessionId = useSessionStore((s) => s.sessionId)
  const [data, setData] = useState<ExplainInferenceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const refresh = useCallback(
    async (objectId: string | null) => {
      const seq = ++requestSeq.current
      if (!objectId || !sessionId.trim()) {
        setData(null)
        setError(null)
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const result = await explainKnowledge(sessionId, objectId)
        if (seq !== requestSeq.current) return
        setData(result)
      } catch (e) {
        if (seq !== requestSeq.current) return
        setData(null)
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (seq === requestSeq.current) setIsLoading(false)
      }
    },
    [sessionId],
  )

  return { data, isLoading, error, refresh }
}
